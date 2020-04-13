
class KtRenderable extends HTMLTemplateElement {

    constructor() {
        super();
        this._hlpr = new KtHelper();
    }

    /**
     *
     * @param {HTMLElement} node
     * @param {object} context
     */
    renderRecursive(node, context, ownerNodes) {
        if (typeof node.render === "function") {
            node.render(context);
            return;
        }
        if (node.hasOwnProperty("ktOwner") && ownerNodes !== true)
            return;

        for(let curNode of node.childNodes) {
            if (node.ktSkipRender === true)
                return;
            this.renderRecursive(curNode, context);
        }

    }

}



