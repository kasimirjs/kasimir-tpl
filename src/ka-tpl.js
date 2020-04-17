var KASELF = null;

class KaTpl extends KtRenderable {


    constructor() {
        super();
        this._attrs = {
            "debug": false,
            "stmt": null,
            "afterrender": null
        };

        // Switched to to during _init() to allow <script> to set scope without rendering.
        this._isInitializing = false;
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
            document.addEventListener("DOMContentLoaded", () => {
                this._init();
                this.render(this._scope)
            });
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

        // Render only if dom available (allow <script> inside template to set scope before first rendering
        if ( ! this._isInitializing)
            this.render(this._scope);
    }

    get $scope() {
        return new Proxy(this._scope, {
            set: (target, property, value, receiver) => {
                target[property] = value;
                this.render(this.$scope);
            }
        });
    }



    _init() {
        if (this._els !== null)
            return;
        this._isInitializing = true;
        if (this.nextElementSibling !== null) {
            // Remove loader element
            if (this.nextElementSibling.hasAttribute("ka-loader"))
                this.parentElement.removeChild(this.nextElementSibling);
        }
        let sibling = this.nextSibling;
        (new KtTemplateParser).parseRecursive(this.content);

        let cn = this.content.cloneNode(true);
        this._els = [];
        this._log(cn.children);
        for (let cel of cn.children) {
            cel.ktOwner = this._ktId;
            this._els.push(cel);
        }
        KASELF = this;
        this.parentElement.insertBefore(cn, sibling);

        this._isInitializing = false;
    }

    render($scope) {
        this._log("render($scope= ", $scope, ")");
        this._init();
        for(let ce of this._els) {
            this.renderRecursive(ce, $scope, true);
        }
    }
}

customElements.define("ka-tpl", KaTpl, {extends: "template"});