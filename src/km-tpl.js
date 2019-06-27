


class KmTplElem extends HTMLElement {

    constructor() {
        super();

        this._attrs = {
            bind: null,
            observe: null,
        };
        this._config = {
        };

        /**
         *
         * @type {KasimirTemplate}
         */
        this.tpl = null;
    }


    static get observedAttributes() { return ["bind", "observe"]; }

    attributeChangedCallback(name, oldValue, newValue) {
        this._attrs[name] = newValue;
    }

    connectedCallback() {
        window.addEventListener("load", () => {
            console.log("load", window["data"]);
            let template = this.querySelector("template");
            if (template === null) {
                console.error("<km-tpl> has no template child.", this);
                throw "<km-tpl> requires <template> child.";
            }

            this.tpl = kasimir_tpl(template);
            this.removeChild(template);
            this.tpl.renderIn(this);

            if (this._attrs.bind !== null) {
                this.tpl.bind(window[this._attrs.bind]);
            }
            if (this._attrs.observe) {
                let observed = window[this._attrs.observe];
                console.log(observed);
                if (typeof observed !== "object")
                    throw "observed variable window['" + this._attrs.observe + "'] is typeof " + (typeof observed) + " but object required";
                this.tpl.observe(observed);
            }
        });
    }

    disconnectCallback() {

    }

}

customElements.define("km-tpl", KmTplElem);

