
class KT_Renderable extends HTMLElement
{
    constructor() {
        super();
        this.state = {
            origNode: null
        };

    }

    /**
     *
     * @param {HTMLElement} node
     * @param scope
     */
    renderRecursive(node, scope){
        if ( ! node.hasChildNodes())
            return;
        // console.log("renderRecursive", node);
        for (let curNode of node.childNodes) {

            if (typeof curNode.render === "function") {
                console.log("render", curNode);
                curNode.render(scope);
                continue;
            }
            this.renderRecursive(curNode, scope);
        }
    }


    initRecursive(node) {
        if (typeof node === "undefined")
            node = this;

        if (typeof node.onKtInit === "function")
            node.onKtInit();

        for (let curNode of node.childNodes) {

            this.initRecursive(curNode);
        }

        if (typeof node.onAfterKtInit === "function")
            node.onAfterKtInit();
    }
}

var KT_FN = {
    /**
     *
     * @param {HTMLElement} elem
     * @param {string} val
     * @param scope
     */
    "[class]": function(elem, val, scope) {
        "use strict";
        try {
            var classes = null;
            let e = "classes = " + val;
            let ret = eval(e);
            console.log("eval", e, "ret: ", ret, "classes:", classes);
        } catch (e) {
            throw e + " in [data] of " + elem.outerHTML;
        }
        for (let className in classes) {
            if ( ! classes.hasOwnProperty(className))
                continue;
            if (classes[className] === true) {
                elem.classList.add(className);
            } else {
                elem.classList.remove(className);
            }
        }
    }
};
var KT_DATA = [];

