


class KtIf extends KtRenderable {


    constructor() {
        super();
        this.elements = null;
        this.params = {
            "stmt": null
        }
    }

    static get observedAttributes() {
        return ["stmt"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }

    render(context) {
        let stmt = this.params.stmt;
        let $ = context;
        let isTrue = eval(stmt);

        if (isTrue) {

            if (this.elements !== null) {
                for (let curElement of this.elements)
                    this.renderRecursive(curElement, context, true);
                return;
            }
            let newNode = this.content.cloneNode(true);
            this.elements = [];
            for (let curNode of newNode.childNodes) {
                curNode.ktOwner = "if";
                this.elements.push(curNode);
            }
            for (let i = this.elements.length-1; i>=0; i--) {
                this.parentElement.insertBefore(this.elements[i], this.nextSibling);
            }
            for (let curNode of this.elements)
                this.renderRecursive(curNode, context, true);
        } else {
            if (this.elements === null)
                return;
            for (let node of this.elements)
                this.parentElement.removeChild(node);
            this.elements = null;
        }

    }
}

customElements.define("kt-if", KtIf, {extends: "template"});