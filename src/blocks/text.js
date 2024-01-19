// @ts-check
/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Blockly from 'blockly/core';

export const TYPES = [
  "String",
  "Number",
  "Boolean"
]

// /**
//  * @param {Blockly.Block} block
//  * @param {string}        type
//  */
// function addConjoin(block, type) {
//   block.setInputsInline(true)
//   // block.setOutputShape(3)
//   block.appendValueInput("THEN")
  
// }

/**
 * 
 * @param {Record<string, Omit<Partial<Blockly.Block>, "init"> & { init(this: Blockly.Block): void }} blocks 
 */
export default function addBlocks(blocks) {
  blocks["if"] = {
    init() {
      this.setStyle("control")
      this.appendValueInput("CONDITION")
        .setCheck("Boolean")
        .appendField("if")
      this.appendEndRowInput()
        .appendField("then")
      this.appendStatementInput("BODY")
        .setCheck(["code"])
      this.setPreviousStatement(true, ["code"])
      this.setNextStatement(true, ["code", "elif", "else"])
    }
  }
  blocks["elif"] = {
    init() {
      this.setStyle("control")
      this.appendValueInput("CONDITION")
        .setCheck("Boolean")
        .appendField("else if")
      this.appendEndRowInput()
        .appendField("then")
      this.appendStatementInput("BODY")
        .setCheck(["code"])
      this.setPreviousStatement(true, ["elif"])
      this.setNextStatement(true, ["code", "elif", "else"])
    }
  }
  blocks["else"] = {
    init() {
      this.setStyle("control")
      this.appendEndRowInput()
        .appendField("else")
      this.appendStatementInput("BODY")
        .setCheck(["code"])
      this.setPreviousStatement(true, ["else"])
      this.setNextStatement(true, ["code"])
    }
  }
  blocks["while"] = {
    init() {
      this.setStyle("control")
      this.appendValueInput("CONDITION")
        .setCheck("Boolean")
        .appendField("while")
      this.appendEndRowInput()
        .appendField("do")
      this.appendStatementInput("BODY")
        .setCheck(["code"])
      this.setPreviousStatement(true, ["code"])
      this.setNextStatement(true, ["code"])
    }
  }
  blocks["break"] = {
    init() {
      this.setStyle("control")
      this.appendDummyInput()
        .appendField("finish loop early")
      this.setPreviousStatement(true, ["code"])
    }
  }
  blocks["_Boolean"] = {
    init() {
      this.setStyle("control")
      this.appendDummyInput()
        .appendField(new Blockly.FieldCheckbox(true), "VALUE")
      this.setOutput(true, "Boolean")
      // addConjoin(this, "Boolean")
    }
  }
  blocks["and"] = {
    init() {
      this.setStyle("control")
      this.setInputsInline(true)
      this.appendValueInput("A")
      this.appendValueInput("B").appendField(new Blockly.FieldDropdown([["and", "and"], ["or", "or"]]), "OP")
      this.setOutput(true, "Boolean")
    }
  }


  blocks["table"] = {
    init() {
      this.setColour("#535a66")
      this.appendEndRowInput()
        .appendField("table")
      //this.appendStatementInput("BODY")
      //  .setCheck(["tablelist", "tablekeys"])
      this.setNextStatement(true, ["tablelist", "tablekeys"])
      this.setOutput(true, "Table")
    }
  }
  blocks["table_item"] = {
    init() {
      this.setInputsInline(true)
      this.setColour("#535a66")
      this.appendValueInput("VALUE")
        .appendField("value ")
      this.setPreviousStatement(true, "tablelist")
      this.setNextStatement(true, ["tablelist", "tablekeys"])
    }
  }
  blocks["table_key"] = {
    init() {
      this.setInputsInline(true)
      this.setColour("#535a66")
      this.appendValueInput("KEY")
        .appendField("key")
      this.appendValueInput("VALUE")
        .appendField("to value")
      this.setPreviousStatement(true, ["tablelist", "tablekeys"])
      this.setNextStatement(true, "tablekeys")
    }
  }
  blocks["getprop"] = {
    init() {
      this.setInputsInline(true)
      this.setColour("#535a66")
      this.appendValueInput("KEY")
        .appendField("key")
      this.appendValueInput("TABLE")
        .appendField("of")
      this.setOutput(true, [">", ""])
    }
  }

  blocks["literal_stmt"] = {
    init() {
      this.setStyle("advanced")
      this.appendEndRowInput()
        .appendField("Lua code")
      this.appendDummyInput()
        .appendField(new Blockly.FieldMultilineInput(""), "CODE")
      this.setPreviousStatement(true)
      this.setNextStatement(true)
    }
  }
  blocks["literal_expr"] = {
    init() {
      this.setStyle("advanced")
      this.appendDummyInput()
        .appendField("Lua code")
        .appendField(new Blockly.FieldTextInput(""), "CODE")
      this.setOutput(true)
    }
  }
  blocks["error_stmt"] = {
    init() {
      this.setStyle("error")
      this.appendValueInput("VALUE")
        .setCheck("String")
        .appendField("error")
      this.setPreviousStatement(true, "code")
    }
  }
  blocks["error_expr"] = {
    init() {
      this.setStyle("error")
      this.appendValueInput("VALUE")
        .setCheck("String")
        .appendField("error")
      this.setOutput(true)
    }
  }
  blocks["coerce"] = {
    init() {
      this.setStyle("advanced")
      this.appendValueInput("VALUE")
        .appendField("coerce")
      this.setOutput(true)
    }
  }
}