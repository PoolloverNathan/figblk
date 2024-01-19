// @ts-check
import * as Blockly from "blockly"

const luaGenerator = new Blockly.Generator("Lua");
export default luaGenerator;

export const tcb     = (/** @type {Blockly.Block} */ b, f = "VALUE") => luaGenerator.valueToCode(b, f, 0)
export const fv      = (/** @type {Blockly.Block} */ b, f = "VALUE") => b.getFieldValue(f)
export const theBody = (/** @type {Blockly.Block} */ b, f = "BODY")  => luaGenerator.statementToCode(b, f)

const __ = `error("Hole!")`

const nb = (/** @type {Blockly.Block} */ b) => luaGenerator.blockToCode(b.getNextBlock())

/** @type {typeof luaGenerator.forBlock} */
let fb = luaGenerator.forBlock
fb["_Boolean"] = b => [fv(b).toLowerCase(), 0]
fb["if"] = b => `if ${tcb(b, "CONDITION") || __} then
${theBody(b)}
${b.getNextBlock()?.previousConnection?.getCheck()?.includes("if") ? "" : "end\n"}${nb(b)}`
fb["elif"] = b => `elseif ${tcb(b, "CONDITION") || __} then
${theBody(b)}
${b.getNextBlock()?.previousConnection?.getCheck()?.includes("if") ? "" : "end\n"}${nb(b)}`
fb["else"] = b => `else
${theBody(b)}
end
${nb(b)}`

fb["onload"] = b => `do
${theBody(b)}
end
${nb(b)}`
fb["while"] = b => `while ${tcb(b, "CONDITION") || __} do
${theBody(b)}
end
${nb(b)}`

fb["and"] = b => `(${tcb(b, "A") || __} ${fv(b, "OP") } ${tcb(b, "B") || __})`

fb.literal_stmt = b => fv(b, "CODE") + "\n" + nb(b)
fb.literal_expr = b => [fv(b, "CODE") + "\n" + nb(b), 0]
fb.error_stmt = b => `error(${tcb(b)})`
fb.error_expr = b => [`error(${tcb(b)})`, 0]
fb.coerce = b => fv(b)