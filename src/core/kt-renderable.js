
class KtRenderable extends HTMLTemplateElement {

    /**
     *
     * @param {HTMLElement} node
     * @param {object} context
     */
    renderRecursive(node, context) {
        if (typeof node.render === "function") {
            node.render(context);
            return;
        }

        for(let curNode of node.childNodes) {
            this.renderRecursive(curNode, context);
        }

    }

}



