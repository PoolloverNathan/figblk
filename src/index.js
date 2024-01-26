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
  /**
   * @param {(block: Blockly.Block, ev: Blockly.Events.Abstract) => string | null} warnGen 
   */
  set warnGen(warnGen) {
    this.block.setOnChange(ev => {
      this.block.setWarningText(warnGen(this.block, ev))
    })
  }
  /**
   * 
   * @param {IMPLY20[] | Partial<Record<IMPLY20, 0 | 1 | 2>>} obj 
   */
  simpleRequireContext(obj) {
    /// @ts-ignore - the array in obj.map doesn't count as a tuple and Object.entries still isn't key-generic
    /** @type {[IMPLY20, 0 | 1 | 2][]} */ const dms = Array.isArray(obj) ? obj.map(e => [e, 0]) : Object.entries(obj)
    const gw = () => dms.map(([imply, req]) => supplyContextWarning(this.block, imply, req)).filter(a => a).join("\n")
    this.warnGen = gw
    this.block.setWarningText(gw())
  }
}

/**
 * @param {[inputs: string | string[], block: string, fields: Record<string, string>?][]} on
*/
function shad(...on) {
  const i = {}
  for (let [is, bs, fs = {}] of on) {
    for (let ii of is) {
      i[ii] = { shadow: { type: bs, fields: fs } }
    }
  }
  return { inputs: i }
}

/** @typedef {"player" | "host" | "tickDelta" | "renderCtx"} IMPLY20 */
/** @typedef {boolean | null} IMPLIED20 */
/** @type {(block: Blockly.Block, imply: IMPLY20) => IMPLIED20} */
let doimply = (block, imply) => null
/**
 * 
 * @param {string} blkid yes
 * @param {IMPLY20} wimply
 * @param {IMPLIED20} status
 */
function imply20(blkid, wimply, status) {
  const doimply_ = doimply
  doimply = (block, imply) => block.type == blkid && wimply == imply ? status : doimply_(block, imply)
}
/**
 * 
 * @param {Blockly.Block} block
 * @returns {Generator<Blockly.Block>}
 */
function* getSurroundSuppliers(block) {
  /** @type {Blockly.Block?} */ let nBlock = block
  while (nBlock = nBlock.getSurroundParent()) {
    yield nBlock
  }
}
function idk(more) {
  //return `<see https://xkcd.com/2200 - error info: ${more}>`
  //return `<this should never happen (${more})>`
  return more + " (see https://xkcd.com/2200)"
}
/** @type {Record<IMPLY20, [string, string, string, [string, string, string]]>} */
const impliedNames = {
  player: [
    "the player to definitely be loaded",
    "the player to definitely not be loaded",
    "the player to potentially be or not be loaded",
    [
      "they are definitely loaded",
      "they are definitely not loaded",
      "they might or might not be loaded",
    ]
  ],
  host: [
    "the script to be running on just your computer",
    "the script to be running on just someone else's computer",
    "the script to be running on anyone's computer",
    [
      "it's running on just someone else's computer",
      "it's running on just your computer",
      "it's running on every computer",
    ]
  ],
  renderCtx: [
    "the script to be within a player rendering event",
    "the script to not be within a player rendering event",
    idk("the script to simultaneously be and not be in a player rendering event"),
    [
      "it's within a different type of event",
      "it is",
      "it's not within any event",
    ]
  ],
  tickDelta: [
    "the script to be within a player or world rendering event",
    "the script to not be within a player or world rendering event",
    idk("the script to simultaneously be and not be in a player rendering event"),
    [
      "it's within a different type of event",
      "it is",
      "it's not within any event",
    ]
  ],
}
/**
 * 
 * @param {Blockly.Block} block 
 * @param {IMPLY20} imply 
 * @param {0 | 1 | 2} state
 * @returns {string | null}
 */
function supplyContextWarning(block, imply, state) {
  const tfn = [true, false, null]
  const statei = tfn[state]
  let s, rres = null
  for (s of getSurroundSuppliers(block)) {
    const res = doimply(s, imply)
    console.log("scw", block.type, imply, state, s.type, res)
    if (res != undefined) {
      rres = res
      break
    }
  }
  // skip warning if s has a previous or output
  if (rres == statei) return null
  return `This block requires ${impliedNames[imply][state]},\n\u2003but ${impliedNames[imply][3][tfn.indexOf(rres)]}\n\u2003(because of the ${s?.type} block).`
}

let gcats = []

/** @typedef { "host" | "entity" } IMPLIABLE */
/** @typedef {{ fits(block: Blockly.Block, check: (name: string) => boolean): boolean, provides(block: Blockly.Block, name: string): boolean }} IMPLICATIONS */
/** @type {Record<IMPLIABLE, IMPLICATIONS>} */
let blocks_imply = {}
const mismatch_ctx = (name, exp, got) => {
  const namectx = {
    [true]:      "present",
    [false]:     "absent",
    [null]:      "unknown",
    [undefined]: "unspecified",
  }
  return `context '${name}' is ${namectx[got]}, but this block expects it to be ${namectx[exp]}`
}

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
 * @param {(block: (bid: string, isOut: boolean, type: string | false | string[] | null, nextType: string | false | string[] | null, cType: string | false | string[] | null, build: (k: BlockBuilder) => void, codegen: (b: Blockly.Block, f: (f: any) => string, i: string, n: string, s?: () => string) => string, tbgen?: (m: () => ToolboxBlock) => Iterable<ToolboxBlock>, imply?: IMPLICATIONS) => void, foreign: (name: string) => void) => void} define
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
 * @param {(block: (bid: string, isOut: boolean, type: string | false | string[] | null, nextType: string | false | string[] | null, cType: string | false | string[] | null, build: (k: BlockBuilder) => void, codegen: (b: Blockly.Block, f: (f: any) => string, i: string, n: string, s?: () => string) => string, tbgen?: (m: () => ToolboxBlock) => Iterable<ToolboxBlock>, imply?: IMPLICATIONS) => void, foreign: (name: string) => void) => void} define
 */
function excat(cid, cat, define) {
  // const dfltImply = { fits: b => true, provides: () => false }
  /**
   * @param {string} bid
   * @param {boolean} isOut
   * @param {string | false | string[] | null} type
   * @param {string | false | string[] | null} nextType
   * @param {string | false | string[] | null} cType
   * @param {(k: BlockBuilder) => void} build
   * @param {(b: Blockly.Block, f: (f: any) => string, i: string, n: string, s?: () => string) => string} codegen
   * @param {(m: () => ToolboxBlock) => Iterable<ToolboxBlock>} [tbgen]
   */
  function block(bid, isOut, type, nextType, cType, build, codegen = (b, f, i, n) => `error("Code generation for '${bid}' not implemented")\n${n}`, tbgen = m => [m()]) {
    if (typeof tbgen === "object") {
      let otbgen = tbgen
      tbgen = m => [m(otbgen)]
    }
    cat.contents.push(...tbgen(x => Object.assign({ kind: "block", type: bid }, x)))
    Blockly.Blocks[bid] = {
      /**
       * @this {Blockly.Block}
       */
      init() {
        this.setStyle(cid)
        if (type     !== false) this[isOut ? "setOutput" : "setPreviousStatement"](true, type)
        if (nextType !== false) this.setNextStatement(true, nextType)
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
          , body = luaGenerator.statementToCode(b, "BODY")?.trim()
          , next = isOut ? "" : /** @type {string} */ (luaGenerator.blockToCode(b.nextConnection?.targetBlock() ?? null))
          , code = codegen(b, v2c, body, next)
      return isOut ? [code, 0] : code
    }
    if (codegen.length >= 5) {
      forSetBlock[bid] = (b, v) => { 
        const v2c  = f => luaGenerator.valueToCode(b, f, 0)
            , body = luaGenerator.statementToCode(b, "BODY")?.trim()
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
  excat(cid, /** @type {} */ (toolbox.contents.find(c => c.categorystyle === cid + "_category")), define)
}
const scat = () => gcats.push({ kind: "sep" })

cat("event", "Events", "#17c40e", block => {
  /**
   * 
   * @param {string} desc 
   * @param {string} id 
   * @param {Partial<Record<IMPLY20, IMPLIED20>>} give
   */
  function event(desc, id, give = {}) {
    const bid = id == "" ? "onload" : "event_" + id
    block(bid, false, false, false, "code", k => k.field(desc), (b, f, i, n) => `${id == "" ? "do" : `function events.${id}()`}
  ${i}
end`)
    for (let [k, v] of Object.entries(give)) {
      // @ts-ignore - Object.entries isn't generic in its key type
      imply20(bid, k, v)
    }
  }
  event("when avatar is selected", "", { player: false })
  event("when player is loaded", "entity_init", { player: true })
  event("when player is updated", "tick", { player: true })
  event("when world is updated", "world_tick")
  event("when player is rendered", "tick", { player: true, tickDelta: true })
  event("when world is rendered", "world_tick", { tickDelta: true })
  block("render_delta", true, "Number", false, false, k => {
    k.field("tick delta")
    k.simpleRequireContext(["tickDelta"])
  }, () => "__figblk_rdelta")
})
/**
 * Sets up a block's input to help determine its output, and vice versa.
 * The initial types are used to determine which types are acceptable to potentially be an input or output type.
 * @param {Blockly.Block} block The block to set up and register listeners on.
 * @param {string} inputName The name of the input used for this relationship. An invalid name triggers a runtime error.
 * @param {(outType: string) => string[]} outTypeToInType A function returning the possible input types  for an output type, for backwards propagation.
 * @param {(inType:  string) => string[]} inTypeToOutType A function returning the possible output types for an input  type, for forwards  propagation.
*/
function idbOutputCheckedBlock(block, inputName, outTypeToInType, inTypeToOutType) {
  block.setWarningText("This block is generic, which is currently unimplenebted.")
}
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

  const VECS = ["Number", "Vector2", "Vector3", "Vector4"]
  const axesn = v => VECS.indexOf(v) + 1
  const vfaxe = v => VECS[v]
  block("vec2", true, "Vector2", false, false, y => {
    y.field("⟨")
    y.input("X", "Number")
    y.input("Y", "Number")
    y.field("⟩")
  }, (g, d) => `vec(${d("X")}, ${d("Y")})`, shad(["XY", "_Number"]))
  block("vec3", true, "Vector3", false, false, y => {
    y.field("⟨")
    y.input("X", "Number")
    y.input("Y", "Number")
    y.input("Z", "Number")
    y.field("⟩")
  }, (g, d) => `vec(${d("X")}, ${d("Y")}, ${d("Z")})`, shad(["XYZ", "_Number"]))
  block("vec4", true, "Vector4", false, false, y => {
    y.field("⟨")
    y.input("X", "Number")
    y.input("Y", "Number")
    y.input("Z", "Number")
    y.input("W", "Number")
    y.field("⟩")
  }, (g, d) => `vec(${d("X")}, ${d("Y")}, ${d("Z")}, ${d("W")})`, shad(["XYZW", "_Number"]))
  block("vaug", true, VECS.slice(1), false, false, h => {
    h.input("VECTOR", ...VECS.slice(0, -2))
    h.field("augmented with")
    h.input("VALUE", "Number")
    idbOutputCheckedBlock(h.block, "VECTOR", outType => vfaxe(axesn(outType) - 1), inType => vfaxe(axesn(inType) + 1))
  }, (y, z) => `(${z}):augment`)
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
  // foreign("size")
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
    k.simpleRequireContext({ host: 2 })
  }, (g, f, b, n) => {
    const end = g.getNextBlock()?.type === "else" ? "" : "end\n"
    // generate similar to if
    return `if host:isHost() then
  ${b}
${end}${n}`
  })
  imply20("isHost", "host", true)
  foreign("else")
  block("example host block", false, "code", "code", false, k => {
    k.field("requires host")
    k.simpleRequireContext("host")
  }, (g, b, f, n) => n)
/*
  block("slotitem", true, "ItemStack", false, false, k => {
    k.field("item in")
    k.input("VALUE", "Number")
  }, (n, g, b, f) => `host:getSlot(${g("VALUE")})`, { inputs: { VALUE: { shadow: { type: "slot_" } } } })
  block("slot_", true, "Number", false, false, g => {
    const d = g.dropdown("")
    g.dummy()
    const i = g.input("VALUE")
  }
*/
    
  //block("")
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
      INNER_LAYER_:         "Â  - Inner Skin Layer",
      HEAD:                 "Â  Â  Â  - Head",
      BODY:                 "Â  Â  Â  - Torso",
      LEFT_ARM:             "Â  Â  Â  - Left Arm",
      RIGHT_ARM:            "Â  Â  Â  - Right Arm",
      LEFT_LEG:             "Â  Â  Â  - Left Leg",
      RIGHT_LEG:            "Â  Â  Â  - Right Leg",
      OUTER_LAYER_:         "Â  - Outer Skin Layer",
      HAT:                  "Â  Â  Â  - Hat",
      JACKET:               "Â  Â  Â  - Jacket",
      LEFT_SLEEVE:          "Â  Â  Â  - Left Sleeve",
      RIGHT_SLEEVE:         "Â  Â  Â  - Right Sleeve",
      LEFT_PANTS:           "Â  Â  Â  - Left Pants",
      RIGHT_PANTS:          "Â  Â  Â  - Right Pants",
      CAPE_:                "Â  - Cape",
      CAPE_MODEL:           "Â  Â  Â  - Cape Model",
      FAKE_CAPE:            "Â  Â  Â  - Fake Cape",
      ARMOR_:               "All Armor",
      HELMET_:              "Â  - Helmet",
      HELMET_ITEM:          "Â  Â  Â  - Item on Head",
      HELMET_HEAD:          "Â  Â  Â  - Helmet Inner",
      HELMET_HAT:           "Â  Â  Â  - Helmet Hat",
      CHESTPLATE_:          "Â  - Chestplate",
      CHESTPLATE_BODY:      "Â  Â  Â  - Chestplate Body",
      CHESTPLATE_LEFT_ARM:  "Â  Â  Â  - Chestplate Left Shoulder",
      CHESTPLATE_RIGHT_ARM: "Â  Â  Â  - Chestplate Right Shoulder",
      LEGGINGS_:            "Â  - Leggings",
      LEGGINGS_BODY:        "Â  Â  Â  - Leggings Hips",
      LEGGINGS_LEFT_LEG:    "Â  Â  Â  - Left Legging",
      LEGGINGS_RIGHT_LEG:   "Â  Â  Â  - Right Legging",
      BOOTS_:               "Â  - Boots",
      BOOTS_LEFT_LEG:       "Â  Â  Â  - Left Boot",
      BOOTS_RIGHT_LEG:      "Â  Â  Â  - Right Boot",
      ELYTRA_:              "Elytra",
      LEFT_ELYTRA:          "Â  - Elytra Left Wing",
      RIGHT_ELYTRA:         "Â  - Elytra Right Wing",
      HELD_ITEMS_:          "Held Items",
      LEFT_ITEM:            "Â  - Left-hand Item",
      RIGHT_ITEM:           "Â  - Right-hand Item",
      PARROTS_:             "Parrots",
      LEFT_PARROT:          "Â  - Left Parrot",
      RIGHT_PARROT:         "Â  - Right Parrot",
      ALL_:                 "All of the above",
    }, class extends Blockly.FieldDropdown {
      getText() {
        return super.getText().replace(/^(?:Â  Â  )?Â  - /, "")
      }
    })
  }, b => "(vanilla_model." + b.getFieldValue("VALUE").replace(/_$/, "") + ")")
})
class PlayerRequiredIcon extends Blockly.icons.Icon {
  static TYPE = new Blockly.icons.IconType(this.constructor.name)
  getType() { return this.constructor.TYPE }
  /**
   * @param {Blockly.Block} k
   */
  constructor(k) {
    super(k)
    this.setTooltip("This block requires the current player to be loaded, meaning it can only be used in certain events or within an 'if current player is loaded' block.")
  }
}
class PlayerPresentIcon extends Blockly.icons.Icon {
  static TYPE = new Blockly.icons.IconType(this.constructor.name)
  getType() { return this.constructor.TYPE }
  /**
   * @param {Blockly.Block} k
   */
  constructor(k) {
    super(k)
    this.setTooltip("This block guarantees that the current player .")
  }
}
class PlayerAbsentIcon extends Blockly.icons.Icon {
  static TYPE = new Blockly.icons.IconType(this.constructor.name)
  getType() { return this.constructor.TYPE }
  /**
   * @param {Blockly.Block} k
   */
  constructor(k) {
    super(k)
    this.setTooltip("This block guaranteesn't that the current player .")
  }
}
class HostRequiredIcon extends Blockly.icons.Icon {
  static TYPE = new Blockly.icons.IconType(this.constructor.name)
  getType() { return this.constructor.TYPE }
  /**
   * @param {Blockly.Block} k
   */
  constructor(k) {
    super(k)
    this.setTooltip("This block requires information only available from your computer, meaning it can only be used in certain events or within an 'if running on host' block.")
  }
}
class HostPresentIcon extends Blockly.icons.Icon {
  static TYPE = new Blockly.icons.IconType(this.constructor.name)
  getType() { return this.constructor.TYPE }
  /**
   * @param {Blockly.Block} k
   */
  constructor(k) {
    super(k)
    this.setTooltip("This block guarantees that the avatar code is running on you .")
  }
}
class HostAbsentIcon extends Blockly.icons.Icon {
  static TYPE = new Blockly.icons.IconType(this.constructor.name)
  getType() { return this.constructor.TYPE }
  /**
   * @param {Blockly.Block} k
   */
  constructor(k) {
    super(k)
    this.setTooltip("This block guaranteesn't that the avatar code is running on you .")
  }
}
const YEARN = {
  player: [PlayerAbsentIcon, PlayerPresentIcon, PlayerRequiredIcon],
  host:   [HostAbsentIcon,   HostPresentIcon,   HostRequiredIcon],
}
cat("entities", "Entities", "#19966e", block => {
  const ALL_ENTITIES = ["Entity", "Player", "Viewer"]
  block("player", true, "Player", false, false, k => {
  //   k.block.addIcon(new PlayerRequiredIcon(k.block))
    k.field("current player")
    k.simpleRequireContext(["player"])
  }, (x, y, z, w) => `player`)
  block("isPlayer", false, "code", ["else", "code"], "code", k => {
    k.field("if current player is ready")
    k.simpleRequireContext({ player: 2 })
  }, (g, f, b, n) => {
    const end = g.getNextBlock()?.type === "else" ? "" : "end\n"
    // generate similar to if
    return `if player:isLoaded() then
  ${b}
${end}${n}`
  })
  imply20("isPlayer", "player", true)
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
/**
 * @interface Blockly.Block
 * @prop {Record<string, string[]>} [scopedVars_]
*/
function* getVariableOwners(s) {
  let oldvs = {}
  while (s = s.getParent()) {
    if (s.scopedVars_) {
      for (let [v, ck] of s.scopedVars_) {
        if (!oldvs[v]) {
          if (ck && ck[0]) {
            const imp = implementations.get(ck[0])
            if (imp) ck = imp
          }
          yield oldvs[v] = [v, ck, s]
        }
      }
    }
  }
}
function encodeIdent(id) {
	let eid = ""
	for (let c of id) {
  	// per [MDN], `c` is the individual code points of the string
    // [MDN]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/@@iterator
    // encode via adding an underscore then the hex codepoint
    eid += "_" + c.codePointAt().toString(16)
  }
  return eid
}
function decodeIdent(eid) {
	const [empty, ...parts] = eid.split("_")
  if (empty) throw new Error("decoded idents must start with _")
  return parts.map(n => parseInt(n, 16)).map(n => String.fromCodePoint(n)).join("")
}

cat("vars", "Variables", "#ff9d00", (block, foreign) => {
  block("global", false, false, false, false, k => {
    k.field("declare global")
  //   k.field(new TypeDropdown(), "TYPE")
    k.field(new Blockly.FieldTextInput("x", name => name && !ws.getTopBlocks().some(v => v.type == "global" && k.getFieldValue("NAME") == v.getFieldValue("NAME"))), "NAME")
  }, (b, f, i, n) => {
    return ""
  })
  block("var", true, null, false, false, k => {
    k.text("VAR", "x", s => /\p{XID_Start}\p{XID_Continue}*/u.test(s) && s)
  }, (b, f, i, n, s) => b.getFieldValue("VAR") + (s ? " = " + s() : ""))
  block("set", false, "code", "code", false, k => {
    k.field("set")
    k.input("VAR", "Variable")
    k.field("to")
    k.input("VALUE")
    k.block.setOnChange(() => {
      
    })
  }, (b, f, i, n) => {
    let t = b.getInputTargetBlock("VAR"), v = f("VALUE")
    if (!t) {
      return ``
    } else if (!forSetBlock[t.type]) {
      console.log(forSetBlock)
      return `error("block '${t.type}' connected to Variable input (${b.id}) but has no reverse generator")`
    } else {
      return forSetBlock[t.type](t, v)
    }
  })
  // block("function", false, false, ["funcarg", "funcbody"], false, k => {
  //   k.field("function")
  //   k.text("NAME")
  // })
  // block("funcarg", false, ["funcarg"], ["funcarg", "funcbody"], false, k => {
  //   k.field("â")
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
  }, (b, f, i, n) => `local function __figblk_ccont()
  ${n.replace(/^/, "  ").trim()}
end
${i.replace(/^  /, "").trim()}`)
  block("getcont", true, "Function", false, false, k => {
    k.field("captured continuation")
  }, () => "(__figblk_ccont)")
  block("switch", false, "code", "code", "switch", k => {
    k.field("match")
    k.input("VALUE")
  }, (b, f, i, n) => `local __figblk_switch = ${f("VALUE") || "error('Hole!')"}
do
  ${i.replace(/^(\s+)else/, "$1").trimEnd().replace(/(?<=.)$/, "\n  end")}
end
${n}`)
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
  renderer: "thrasos",
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
