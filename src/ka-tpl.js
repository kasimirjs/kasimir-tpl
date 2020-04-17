class KaTpl extends KtRenderable {


    constructor() {
        super();
        this._attrs = {
            "debug": false,
            "stmt": null,
            "afterrender": null
        };
        this._scope = {};
    }

    static get observedAttributes() {
        return ["stmt", "debug"];
    }


    disconnectedCallback() {
        for (let el of this._els)
            this.parentElement.removeChild(el);
    }

    connectedCallback() {
        if (this.hasAttribute("auto")) {
            document.addEventListener("DOMContentLoaded", () => this.render({}));
        }
    }

    /**
     * Set the scope and render the template
     *
     * ```
     * ka_tpl("tpl01").$scope = {name: "bob"};
     * ```
     *
     * @param val
     */
    set $scope(val) {
        this._scope = val;
        this.render(this._scope);
    }

    get $scope() {
        return this._scope;
    }



    render($scope) {
        if (this._els === null) {
            // First rendering: Attach template content to parent element
            if (this.nextElementSibling !== null) {
                // Remove loader element
                if (this.nextElementSibling.hasAttribute("ka-loader"))
                    this.parentElement.removeChild(this.nextElementSibling);
            }
            let sibling = this.nextSibling;
            (new KtTemplateParser).parseRecursive(this.content);

            let cn = this.content.cloneNode(true);
            this._els = [];

            for (let cel of cn.children) {
                cel.ktOwner = "tpl";
                this._els.push(cel);
                this._log("render(): add", cel);
                this.parentElement.insertBefore(cel, sibling);
            }
        }
        for(let ce of this._els) {
            this.renderRecursive(ce, $scope, true);
        }
    }
}

customElements.define("ka-tpl", KaTpl, {extends: "template"});