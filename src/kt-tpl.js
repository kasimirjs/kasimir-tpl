class KtTpl extends HTMLElement {


    constructor() {
        super();
        this.elements = [];
        this.params = {
            "stmt": null
        }
    }
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
    static get observedAttributes() {
        return ["stmt"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }

    render(context) {
        for(let curNode of this.childNodes) {
            this.renderRecursive(curNode, context);
        }
    }
}

customElements.define("kt-tpl", KtTpl);