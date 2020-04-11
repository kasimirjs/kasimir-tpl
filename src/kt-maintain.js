


class KtMaintain extends KtRenderable {


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

        if (this.elements !== null) {
            for (let curElement of this.elements)
                this.renderRecursive(curElement, context, true);
            return;
        }
        let newNode = this.content.cloneNode(true);
        this.elements = [];
        for (let curNode of newNode.childNodes) {
            curNode.ktOwner = "maintain";
            this.elements.push(curNode);
        }
        for (let i = this.elements.length-1; i>=0; i--) {
            this.parentElement.insertBefore(this.elements[i], this.nextSibling);
        }
        for (let curNode of this.elements)
            this.renderRecursive(curNode, context, true);

    }
}

customElements.define("kt-maintain", KtMaintain, {extends: "template"});