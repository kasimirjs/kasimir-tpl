


class KtFor extends KtRenderable {


    constructor() {
        super();
        this.elements = [];
        this.params = {
            "forselect": null,
            "foridx": "idx",
            "foreval": null
        }
    }

    static get observedAttributes() {
        return ["forselect", "foridx", "foreval"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }

    render(context) {
        let select = context[this.params.forselect];

        if (typeof select !== "object") {
            console.warn(`Invalid forSelect="${this.params.forselect}" returned:`, select, "on context", context, "(Element: ", this.outerHTML, ")");
            throw "Invalid forSelect selector. see waring."
        }


        for (let idx = this.elements.length; idx < select.length; idx++ ) {
            let newNode = this.content.cloneNode(true);
            let nodes = [];
            for (let curNode of newNode.childNodes)
                nodes.push(curNode);
            this.elements.push({
                node: nodes
            });
            this.parentElement.insertBefore(newNode, this.nextSibling);
        }

        for (let idx = 0; idx < select.length; idx++) {
            context[this.params.foridx] = idx;
            context["self"] = select[idx];
            if (this.params.foreval !== null)
                eval(this.params.foreval);
            for (let curNode of this.elements[idx].node) {
                this.renderRecursive(curNode, context);
            }
        }


        for (let idx = this.elements.length; select.length < this.elements.length; idx++) {
            let elem = this.elements.pop();
            for (let curNode of elem.node)
                this.parentElement.removeChild(curNode);
        }
    }
}

customElements.define("kt-for", KtFor, {extends: "template"});