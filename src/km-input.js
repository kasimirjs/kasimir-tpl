


class KmInputElem extends HTMLInputElement {

    constructor() {
        super();
        this._attrs = {
            bind: null,
            observe: null,
            scope: null
        };
        this._config = {
        };

    }


    static get observedAttributes() { return ["bind"]; }

    attributeChangedCallback(name, oldValue, newValue) {
        this._attrs[name] = newValue;
    }

    connectedCallback() {
        console.log("connected!!!", this);
        console.log(window.status);

        try {
            this.value = eval(this._attrs.bind);

            this.onchange = () => {
                console.log("change", this.value);
                eval(this._attrs.bind + " = this.value");
            }
        } catch (e) {
            console.error(e + " in element ", this);
            throw e;
        }

    }

}

customElements.define("km-input", KmInputElem, {extends: "input"});

