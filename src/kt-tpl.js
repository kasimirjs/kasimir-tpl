class KtTpl extends HTMLElement {


    constructor() {
        super();
        this.elements = [];
        this.params = {
            "stmt": null
        }
        this.scope = {};
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
        if (node.hasOwnProperty("ktOwner"))
            return;
        for(let curNode of node.childNodes) {
            this.renderRecursive(curNode, context);
        }

    }
    static get observedAttributes() {
        return ["stmt"];
    }

    set $(val) {
        this.scope = val;
        this.renderRecursive(this.scope);
    }

    get $() {
        return this.scope;
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