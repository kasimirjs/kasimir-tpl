class KtVal extends HTMLElement {


    constructor() {
        super();
        this.elements = [];
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
        this.innerText = eval(this.params.stmt);
    }
}

customElements.define("kt-val", KtVal);