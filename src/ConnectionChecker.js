// @ts-check

import * as Blockly from "blockly"

/**
 * @param {Blockly.IConnectionChecker} old 
 * @returns {Blockly.IConnectionChecker}
 */
export default function makeConnectionChecker(old) {
    /**
     * @param {Blockly.Connection} a 
     * @param {Blockly.Connection} b 
     * @param {boolean} drag
     * @returns {boolean}
     */
    function okToConnect(a, b, drag) {
        console.log(a, a.getSourceBlock(), b, b.getSourceBlock())
        if (a.getSourceBlock().type == "break") {
            let other = Math.random() ? b.getSourceBlock() : null // nullability hack
            while (other) {
                console.log("OK", other.type)
                other = other.getPreviousBlock()
            }
            // a.dispose()
            // b.dispose()
            return false
        }
        return true
    }
    return Object.assign(Object.create(old), {
        /**
         * @param {Blockly.Connection} a 
         * @param {Blockly.Connection} b 
         * @returns {boolean}
         */
        doTypeChecks(a, b) {
            return okToConnect(a, b, false) && okToConnect(b, a, false) && old.doTypeChecks(a, b)
        },
        // /**
        //  * @param {Blockly.RenderedConnection} a 
        //  * @param {Blockly.RenderedConnection} b 
        //  * @param {number} d
        //  * @returns {boolean}
        //  */
        // doDragChecks(a, b, d) {
        //     return okToConnect(a, b, true) && okToConnect(b, a, true) && old.doDragChecks(a, b, d)
        // }
    })
}