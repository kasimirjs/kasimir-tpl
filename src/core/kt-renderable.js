
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


var KT_DATA = [];

