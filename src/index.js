// @ts-check
/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly';
import addBlocks from './blocks/text';
// @ts-ignore
import {DisableTopBlocks} from '@blockly/disable-top-blocks';
import luaGenerator, { theBody } from './generators/lua';
import {save, load} from './serialization';
import {toolbox} from './toolbox';
import './index.css';
// import 'file!./exported_docs.json';
import makeConnectionChecker from './ConnectionChecker';

Object.keys(Blockly.Blocks).forEach(k => delete Blockly.Blocks[k])
console.log(Blockly.Blocks)
addBlocks(Blockly.Blocks)

const theme = Blockly.Themes.Classic
function paint(style, color, hat) {
  theme.setCategoryStyle(style + "_category", {
    colour: color
  })
  // @ts-expect-error
  theme.setBlockStyle(style, {
    colourPrimary: color,
    hat
  })
}
paint("control",  "#038cfc")
paint("table",    "#535a66")
paint("advanced", "#854ab0")
paint("error",    "#ff0000")

class BlockBuilder {
  /** @type {Blockly.Block} */
  block
  /** @type {[string | Blockly.Field<any>, string?][]} */
  #fieldQueue = []
  #inCount = 0
  constructor(/** @type {Blockly.Block} */ block) {
    this.block = block
  }
  /**
   * @param {string | Blockly.Field<any>} f
   * @param {string | undefined}          [name]
   */
  field(f, name) {
    this.#fieldQueue.push([f, name ?? void name])
  }
  /**
   * Adds a text field to the block.
   * @param {string} name The text field's name, used when getting its value.
   * @param {string} [text] The field's text, by default an empty string.
   * @param {(value: string) => string | null | undefined} [vali] A validator for the field. By default, any value is accepted.
   * @param {{ new(text?: string, vali?: (value: string) => string | null | undefined): Blockly.FieldTextInput }} [klass] The class to use for creating the field.
   * @returns {Blockly.FieldTextInput} A reference to the field.
  */
  text(name, text, vali, klass = Blockly.FieldTextInput) {
    const o = new klass(text, vali)
    this.field(o, name)
    return o
  }
  /**
   * Adds a dropdown field to the block
   * @param {string} name The dropdown's name, used when getting its value.
   * @param {Record<string, string>} opts The options to display in the dropdown. The key is the internal value, and the value is the displayed text.
   * @param {{ new(items: Blockly.MenuGenerator): Blockly.FieldDropdown }} [klass] The class to use for creating the field.
   * @returns {Blockly.FieldDropdown}
   */
  dropdown(name, opts, klass = Blockly.FieldDropdown) {
    const entries = Object.entries(opts)
    for (let entry of entries) entry.reverse() // because the options are specified as [text, value][]
    const o = new klass(entries)
    this.field(o, name)
    return o
  }
  /**
   * @param {Blockly.Input} input
   */
  dumpFieldQueue(input) {
    for (let [f, name] of this.#fieldQueue) {
      input.appendField(f, name)
    }
    this.#fieldQueue = []
  }
  /**
   * @param {string}   name
   * @param {string[]} types
   */
  input(name, ...types) {
    this.#inCount++
    const ntypes = types.length ? types : null
    const input = this.block.appendValueInput(name)
      .setCheck(ntypes)
    this.dumpFieldQueue(input)
    return input
  }
  /**
   * @param {string | undefined} [name]
   */
  newline(name) {
    this.#inCount++
    const input = this.block.appendEndRowInput(name)
    this.dumpFieldQueue(input)
  }
  /**
   * @param {string | undefined} [name]
   */
  dummy(name) {
    if (this.#fieldQueue?.length) {
      this.#inCount++
      const input = this.block.appendDummyInput(name)
      this.dumpFieldQueue(input)
    }
  }
  get inline() {
    return this.#inCount > 1
  }
  set inline(inline) {
    this.#inCount = inline ? Infinity : -Infinity
  }
}

let gcats = []
const IMPLY_ENTITY = Symbol("IMPLY_ENTITY")
const IMPLY_HOST   = Symbol("IMPLY_HOST")

/** @typedef {typeof IMPLY_ENTITY | typeof IMPLY_HOST} IMPLIED */
/** @type {Record<string, Record<IMPLIED, boolean | undefined>>} */
let blocks_imply = {}

/** @type {Map<string, Set<string>>} */
let implementations = new Map()
/** @param {string} iface @param {string} type */
function implfor(iface, type) {
  let set = implementations.get(iface)
  if (!set) {
    set = new Set()
    implementations.set(iface, set)
  }
  set.add(type)
}
/** @param {string} iface @returns {Iterable<string>} */
function impls(iface) {
  return implementations.get(iface) ?? []
}

/**
 * @param {string} cid
 * @param {string} name
 * @param {string} color
 * @param {(block: (bid: string, isOut: boolean, type: string | false | string[] | null, nextType: string | false | string[] | null, cType: string | false | string[] | null, build: (k: BlockBuilder) => void, codegen: (b: Blockly.Block, f: (f: any) => string, i: string, n: string) => string) => void, define: (name: string) => void) => void} define
 */
function cat(cid, name, color, define) {
  const cat = /** @type {const} */ ({
    kind: "category",
    name,
    categorystyle: cid + "_category",
    /** @type {{ kind: "block", type: string }[]} */
    contents: [],
  })
  gcats.push(cat)
  paint(cid, color.replace(/!hat$/, ""), color.endsWith("!hat"))
  excat(cid, cat, define)
}
/**
 * @typedef ToolboxBlock
 * @prop {"block"} kind
 * @prop {string} type
 * @prop {Record<string, unknown>} [fields]
 * @prop {Record<string, Omit<ToolboxBlock, "kind"> extends infer K ? { block: K } | { shadow: K } : never>} [inputs]
*/
let forSetBlock = {}
/**
 * @param {string} cid
 * @param {{ kind: "category", contents: {}[] }} cat
 * @param {(block: (bid: string, isOut: boolean, type: string | false | string[] | null, nextType: string | false | string[] | null, cType: string | false | string[] | null, build: (k: BlockBuilder) => void, codegen: (b: Blockly.Block, f: (f: any) => string, i: string, n: string) => string, tbgen?: (m: () => ToolboxBlock) => Iterable<ToolboxBlock>) => void, foreign: (name: string) => void) => void} define
 */
function excat(cid, cat, define) {
  /**
   * @param {string} bid
   * @param {boolean} isOut
   * @param {string | false | string[] | null} type
   * @param {string | false | string[] | null} nextType
   * @param {string | false | string[] | null} cType
   * @param {(k: BlockBuilder) => void} build
   * @param {(b: Blockly.Block, f: (f: any) => string, i: string, n: string) => string} codegen
   * @param {(m: () => ToolboxBlock) => Iterable<ToolboxBlock>} [tbgen]
   */
  function block(bid, isOut, type, nextType, cType, build, codegen = (b, f, i, n) => `error("Code generation for '${bid}' not implemented")\n${n}`, tbgen = m => [m()], /** @type {IMPLIED[]} */ imply = []) {
    cat.contents.push(...tbgen(() => ({ kind: "block", type: bid })))
    Blockly.Blocks[bid] = {
      /**
       * @this {Blockly.Block}
       */
      init() {
        this.setStyle(cid)
        if (type     !== false) this[isOut ? "setOutput" : "setPreviousStatement"](true, type)
        if (nextType !== false) this.setNextStatement(true, nextType)
        let inCount = 0
        // create a builder
        const builder = new BlockBuilder(this)
        build(builder)
        builder.dummy() // unfinished inputs
        this.setInputsInline(builder.inline)
        if (cType !== false) this.appendStatementInput("BODY").setCheck(cType)
      }
    }
    luaGenerator.forBlock[bid] = b => {
      const v2c  = f => luaGenerator.valueToCode(b, f, 0)
          , body = luaGenerator.statementToCode(b, "BODY")
          , next = isOut ? "" : /** @type {string} */ (luaGenerator.blockToCode(b.nextConnection?.targetBlock() ?? null))
          , code = codegen(b, v2c, body, next)
      return isOut ? [code, 0] : code
    }
    if (codegen.length >= 5) {
      forSetBlock[bid] = (b, v) => { 
        const v2c  = f => luaGenerator.valueToCode(b, f, 0)
            , body = luaGenerator.statementToCode(b, "BODY")
            , next = isOut ? "" : /** @type {string} */ (luaGenerator.blockToCode(b.nextConnection?.targetBlock() ?? null))
        return codegen(b, v2c, body, next, () => v)
      }
    }
  }
  /**
   * @param {string} name
   */
  function foreign(name) {
    cat.contents.push({ kind: "block", type: name })
  }
  define(block, foreign)
}
function nexcat(cid, define) {
  excat(cid, toolbox.contents.find(c => c.categorystyle === cid + "_category"), define)
}
const scat = () => gcats.push({ kind: "sep" })

cat("event", "Events", "#17c40e", block => {
  function event(desc, id) {
    block(id == "" ? "onload" : "event_" + id, false, false, false, "code", k => k.field(desc), (b, f, i, n) => `${id == "" ? "do" : `function events.${id}()`}
${i}
end`)
  }
  event("when avatar is selected", "")
  event("when player is loaded", "entity_init")
})
// toolbox defs go here
cat("math", "Math", "#1b5937", (block, foreign) => {
  block("_Number", true, "Number", false, false, b => b.text("VALUE", 0, n => isNaN(n) ? null : Number(n)), (b, f) => b.getFieldValue("VALUE") || 0)
  block("percent", true, "Number", false, false, b => b.text("VALUE", 0, n => isNaN(n) ? null : Number(n), class extends Blockly.FieldTextInput { getText() { return super.getText() + "%" } }), (b, f) => b.getFieldValue("VALUE") / 100 || 0)
  let mcons = {
    "math.pi": "π",
    "(math.pi*2)": "τ",
    "math.huge": "∞",
    "(-math.huge)": "-∞",
  }
  block("mcon", true, "Number", false, false, b => b.dropdown("VALUE", mcons), (b, f) => b.getFieldValue("VALUE") /* , m => Object.keys(mcons).map(k => m({ fields: { VALUE: k } })) */)
  let mbops = {
    "% + $": "+",
    "% - $": "-",
    "% * $": "×",
    "% / $": "÷",
    "% ^ $": "to the power of",
  }
  block("mbop", true, "Number", false, false, b => {
    b.input("A", "Number")
    /* b.dropdown("OP", mbops, class extends Blockly.FieldDropdown {
      getText() {
        return super.getText().replace(/^th /, or => {
          const b2 = b.block.getInputTargetBlock("A")
          if (b2?.type == "_Number") {
            const fv = b2.getFieldValue("VALUE") % 10
            switch (fv) {
              case 1:  return "st "
              case 2:  return "nd "
              case 3:  return "rd "
            }
          }
          return or
        })
      }
    })*/
    b.dropdown("OP", mbops)
    b.input("B", "Number")
  }, (b, f) => "(" + b.getFieldValue("OP").replace("%", f("A")).replace("$", f("B")) + ")", { inputs: { A: { shadow: { type: "_Number", fields: { "VALUE": 2 } } }, B: { shadow: { type: "_Number", fields: { "VALUE": 2 } } } } })
})
cat("string", "Text", "#2ad4c8", (block, foreign) => {
  block("_String", true, "String", false, false, b => b.text("VALUE"), (b, f) => JSON.stringify(b.getFieldValue("VALUE") || ""))
  block("print", false, "code", "code", false, b => {
    b.field("print")
    b.input("VALUE")
  }, (b, f) => `print(${f("VALUE") || "''"})`)
  block("print2", false, "code", "code", false, b => {
    b.field("log")
    b.input("VALUE")
  }, (b, f) => `log(${f("VALUE") || "''"})`)
  block("concat", true,  "String", false, false, b => {
    b.input("A", "String")
    b.field("followed by")
    b.input("B", "String")
  }, (b, f) => `(${f("A")} .. ${f("B")})`)
  foreign("size")
  block("substr", true, "String", false, false, k => {
    k.field("letters")
    k.input("MIN", "Number")
    k.field("to")
    k.input("MAX", "Number")
    k.field("of")
    k.input("VALUE", "String")
  }, (b, f, i, n) => `string.sub(${f("VALUE") || ""}, ${f("MIN") || ""}, ${f("VALUE") || ""})`)
})
let typecols = {}
scat()
cat("host", "Host", "#c7bf1c", (block, foreign) => {
  block("isHost", false, "code", ["else", "code"], "code", k => {
    k.field("if running on host")
  }, (g, f, b, n) => {
    const end = g.getNextBlock()?.type === "else" ? "" : "end\n"
    // generate similar to if
    return `if host:isHost() then
  ${b}
${end}${n}`
  })
  foreign("else")
})
cat("world", "World", "#704d30", (block, foreign) => {
  block("isWorld", false, "code", ["else", "code"], "code", k => {
    k.field("if world is loaded")
  }, (g, f, b, n) => {
    const end = g.getNextBlock()?.type === "else" ? "" : "end\n"
    // generate similar to if
    return `if world.exists() then
  ${b}
${end}${n}`
  })
  foreign("else")
})
cat("model", "Models", "#b214a2", (block, foreign) => {
  foreign("set")
  block("visibility", true, ["Variable", "Boolean"], false, false, k => {
    k.field("is")
    k.input("VALUE", "VanillaPart", "ModelPart")
    k.field("visible?")
  }, (b, f, i, n, s) => `${f("VALUE") || "error('Hole!')"}:${s ? `setVisible(${s()})` : "isVisible()"}\n`)
  // block("visibility=", false, "code", "code", false, k => {
  //   k.field("set visibility of")
  //   k.input("PART", "VanillaPart", "ModelPart")
  //   k.field("to")
  //   k.input("VALUE", "Boolean")
  // }, (b, f, i, n) => `${f("PART")}:setVisible(${"VALUE"})\n`)
})
cat("vanilla_model", "Vanilla Model", "#a18d63", (block, foreign) => {
  foreign("set")
  foreign("visibility")
  block("vanillaModelPart", true, "VanillaPart", false, false, k => {
    k.dropdown("VALUE", {
      PLAYER_:              "Entire Player",
      INNER_LAYER_:         "  - Inner Skin Layer",
      HEAD:                 "      - Head",
      BODY:                 "      - Torso",
      LEFT_ARM:             "      - Left Arm",
      RIGHT_ARM:            "      - Right Arm",
      LEFT_LEG:             "      - Left Leg",
      RIGHT_LEG:            "      - Right Leg",
      OUTER_LAYER_:         "  - Outer Skin Layer",
      HAT:                  "      - Hat",
      JACKET:               "      - Jacket",
      LEFT_SLEEVE:          "      - Left Sleeve",
      RIGHT_SLEEVE:         "      - Right Sleeve",
      LEFT_PANTS:           "      - Left Pants",
      RIGHT_PANTS:          "      - Right Pants",
      CAPE_:                "  - Cape",
      CAPE_MODEL:           "      - Cape Model",
      FAKE_CAPE:            "      - Fake Cape",
      ARMOR_:               "All Armor",
      HELMET_:              "  - Helmet",
      HELMET_ITEM:          "      - Item on Head",
      HELMET_HEAD:          "      - Helmet Inner",
      HELMET_HAT:           "      - Helmet Hat",
      CHESTPLATE_:          "  - Chestplate",
      CHESTPLATE_BODY:      "      - Chestplate Body",
      CHESTPLATE_LEFT_ARM:  "      - Chestplate Left Shoulder",
      CHESTPLATE_RIGHT_ARM: "      - Chestplate Right Shoulder",
      LEGGINGS_:            "  - Leggings",
      LEGGINGS_BODY:        "      - Leggings Hips",
      LEGGINGS_LEFT_LEG:    "      - Left Legging",
      LEGGINGS_RIGHT_LEG:   "      - Right Legging",
      BOOTS_:               "  - Boots",
      BOOTS_LEFT_LEG:       "      - Left Boot",
      BOOTS_RIGHT_LEG:      "      - Right Boot",
      ELYTRA_:              "Elytra",
      LEFT_ELYTRA:          "  - Elytra Left Wing",
      RIGHT_ELYTRA:         "  - Elytra Right Wing",
      HELD_ITEMS_:          "Held Items",
      LEFT_ITEM:            "  - Left-hand Item",
      RIGHT_ITEM:           "  - Right-hand Item",
      PARROTS_:             "Parrots",
      LEFT_PARROT:          "  - Left Parrot",
      RIGHT_PARROT:         "  - Right Parrot",
      ALL_:                 "All of the above",
    }, class extends Blockly.FieldDropdown {
      getText() {
        return super.getText().replace(/^(?:    )?  - /, "")
      }
    })
  }, b => "(vanilla_model." + b.getFieldValue("VALUE").replace(/_$/, "") + ")")
})
class PlayerRequiredIcon extends Blockly.icons.Icon {
  /**
   * @param {Blockly.Block} k
   */
  constructor(k) {
    super(k)
    this.setTooltip("This block can only be used in certain events, or within a 'if current player is loaded' block.")
  }
}
cat("entities", "Entities", "#19966e", block => {
  const ALL_ENTITIES = ["Entity", "Player", "Viewer"]
  // block("player", true, "Player", false, false, k => {
  //   k.block.addIcon(new PlayerRequiredIcon(k.block))
  //   k.field("current player")
  // })
  block("isPlayer", false, "code", ["else", "code"], "code", k => {
    k.field("if current player is ready")
  }, (g, f, b, n) => {
    const end = g.getNextBlock()?.type === "else" ? "" : "end\n"
    // generate similar to if
    return `if player:isLoaded() then
  ${b}
${end}${n}`
  })
})
scat()
let vartb
/** @abstract */
class TypedDropdown extends Blockly.FieldDropdown {
  /** @abstract @returns {string} */
  type_() {
    throw new Error("abstract method not overridden")
  }
  render_() {
    super.render_()
    let br = this.borderRect_
    if (br) {
      br.style.display = "block"
      br.style.backgroundColor = typecols[this.type_()]
    }
  }
}
class TypeDropdown extends TypedDropdown {
  constructor() {
    super([
      ["text", "String"],
      ["number", "Number"],
      ["boolean", "Boolean"],
    ])
  }
  type_() {
    return this.getValue() || ""
  }
}
cat("vars", "Variables", "#ff9d00", (block, foreign) => {
  // block("global", false, false, false, false, k => {
  //   k.field("declare global")
  //   k.field(new TypeDropdown(), "TYPE")
  //   k.field(new Blockly.FieldTextInput("x"), "NAME")
  // }, (b, f, i, n) => {
  //   return ""
  // })
  block("var", true, null, false, false, k => {
    k.text("VAR")
  }, (b, f, i, n, s) => b.getFieldValue("VAR") + (s ? " = " + s() : ""))
  block("set", false, "code", "code", false, k => {
    k.field("set")
    k.input("VAR", "Variable")
    k.field("to")
    k.input("VALUE")
  }, (b, f, i, n) => {
    let t = b.getInputTargetBlock("VAR"), v = f("VALUE")
    if (!t) {
      return ``
    } else if (!forSetBlock[t.type]) {
      console.log(forSetBlock)
      throw new Error(`block '${t.type}' connected to Variable input but has no reverse generator`)
    } else {
      return forSetBlock[t.type](t, v)
    }
  })
  // block("function", false, false, ["funcarg", "funcbody"], false, k => {
  //   k.field("function")
  //   k.text("NAME")
  // })
  // block("funcarg", false, ["funcarg"], ["funcarg", "funcbody"], false, k => {
  //   k.field("←")
  //   k.text("NAME")
  // })
  // block("funcvar", false, )
})

toolbox.contents.splice(1, 0, ...gcats)

excat("control", toolbox.contents[0], (block) => {
  // block("for", false, "code", "code", )
  block("ignore", false, "code", "code", false, k => k.input("VALUE", "Ignorable"), (b, f, i, n) => f("VALUE"))
  block("do", false, "code", "code", "code", k => {}, (b, f, i, n) => `do\n  ${i}
end\n${n}`)
  block("jump", false, "code", false, false, k => {
    k.field("jump")
  }, (b, f, i, n) => "")
  block("blockarg", true, "Function", "code", false, k => k.field("code"), (b, f, i, n) => `function()
${n}
end`)
  block("fninvoke_stmt", false, "code", ["arg", "code"], false, k => {
    k.field("run")
    k.input("VALUE", "Function")
  }, (b, f, i, n) => {
    let nextArg = b.getNextBlock()
    let args = []
    while (nextArg && nextArg.type == "arg") {
      args.push(luaGenerator.valueToCode(b, "VALUE", 0) || "error('Hole!')")
      nextArg = nextArg.getNextBlock()
    }
    return `(${f("VALUE") || "error('Hole!')"})(${args})`
  })
  block("fninvoke_expr", true, null, ["arg"], false, k => {
    k.field("call")
    k.input("VALUE", "Function")
  }, (b, f, i, n) => {
    let nextArg = b.getNextBlock()
    let args = []
    while (nextArg && nextArg.type == "arg") {
      args.push(luaGenerator.valueToCode(b, "VALUE", 0) || "error('Hole!')")
      nextArg = nextArg.getNextBlock()
    }
    return `(${f("VALUE") || "error('Hole!')"})(${args})`
  })
  block("become", false, "code", ["arg"], false, k => {
    k.field("continue running")
    k.input("VALUE", "Function")
  }, (b, f, i, n) => {
    let nextArg = b.getNextBlock()
    let args = []
    while (nextArg && nextArg.type == "arg") {
      args.push(luaGenerator.valueToCode(b, "VALUE", 0) || "error('Hole!')")
      nextArg = nextArg.getNextBlock()
    }
    return `return (${f("VALUE") || "error('Hole!')"})(${args})`
  })
  block("capturecont", false, "code", "code", "code", k => {
    k.field("capture continuation")
  }, (b, f, i, n) => `local function __figblk_ccont() ${n} end ${i}`)
  block("getcont", true, "Function", false, false, k => {
    k.field("captured continuation")
  }, () => "(__figblk_ccont)")
  block("switch", false, "code", "code", "switch", k => {
    k.field("match")
    k.input("VALUE")
  }, (b, f, i, n) => `local __figblk_switch = ${f("VALUE") || "error('Hole!')"}
do
${i.replace(/^(\s+)else/, "$1").trimEnd().replace(/(?<=.)$/, "\n  end")}
end`)
  block("switchcase", false, "switch", "switch", "code", k => {
    k.field("if it equals")
    k.input("VALUE")
  }, (b, f, i, n) => `elseif __figblk_switch == ${f("VALUE") || "error('Hole!')"} then
${i}
${n}`)
  block("switchelse", false, "switch", false, "code", k => {
    k.field("otherwise")
  }, (b, f, i) => `else
${i}`)
})
nexcat("advanced", block => {
  block("tf", true, null, null, false, k => {
    k.block.setPreviousStatement(true, null)
    k.field("yes")
    k.input("yes")
  }, () => "")
})

// function appendFieldObj(i, f) {
//   let k = "VALUE", v = pfo(f)
//   if (!v) {
//     let e = Object.entries(f)
//     if (e.length == 1) {
//       [[k, v]] = e
//       v = pfo(v)
//     }
//   }
//   if (v) i.appendField(v, k)
// }

// function pfo(f) {
//   if (typeof f == "string") return f
//   if (typeof f == "boolean") return new Blockly.FieldCheckbox(f)
//   if (f instanceof Blockly.Field) return f
//   if (f instanceof Array) {
//     // dropdown
//     return new Blockly.FieldDropdown(f.map(a => Array.isArray(a) ? a : [a, a]))
//   }
// }

// Set up UI elements and inject Blockly
// @ts-ignore
const codeDiv = document.getElementById('generatedCode').firstChild;
const outputDiv = document.getElementById('output');
const blocklyDiv = document.getElementById('blocklyDiv');
// @ts-ignore
const ws = Blockly.inject(blocklyDiv, {
  toolbox,
  sounds: false,
});

// const shapeFor_ = ws.getRenderer().shapeFor
// ws.getRenderer().shapeFor = function(c) {
//   console.log("New shapeFor!")
//   return shapeFor_.call(this, c)
// }

// Add the disableOrphans event handler. This is not done automatically by
// the plugin and should be handled by your application.
ws.addChangeListener(Blockly.Events.disableOrphans);

ws.connectionChecker = makeConnectionChecker(ws.connectionChecker)

// The plugin must be initialized before it has any effect.
const disableTopBlocksPlugin = new DisableTopBlocks();
disableTopBlocksPlugin.init();

// This function resets the code and output divs, shows the
// generated code from the workspace, and evals the code.
// In a real application, you probably shouldn't use `eval`.
const runCode = () => {
  const code = luaGenerator.workspaceToCode(ws);
  // @ts-ignore
  codeDiv.textContent = code;

  // @ts-ignore
  outputDiv.innerHTML = '';

  // eval(code);
};

export const knownEntity = {}
export const knownHost   = {}

// Load the initial state from storage and run the code.
load(ws);
runCode();

// Every time the workspace changes state, save the changes to storage.
ws.addChangeListener((e) => {
  // UI events are things like scrolling, zooming, etc.
  // No need to save after one of these.
  if (e.isUiEvent) return;
  save(ws);
});


// Whenever the workspace changes meaningfully, run the code again.
ws.addChangeListener((e) => {
  // Don't run the code when the workspace finishes loading; we're
  // already running it once when the application starts.
  // Don't run the code during drags; we might have invalid state.
  if (e.isUiEvent || e.type == Blockly.Events.FINISHED_LOADING ||
    ws.isDragging()) {
    return;
  }
  runCode();
});
