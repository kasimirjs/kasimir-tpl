var KASELF = null;

class KaTpl extends KtRenderable {


    constructor() {
        super();
        this._attrs = {
            "debug": false,
            "stmt": null,
            "afterrender": null,
            "nodebounce": false
        };

        // Switched to to during _init() to allow <script> to set scope without rendering.
        this._isInitializing = false;
        this._isRendering = false;
        this._refs = {};
        this._scope = {"$ref":this._refs};
        this.__debounceTimeout = null;
    }

    /**
     * Refer to the current template (should be used by <script> inside a template to reference the
     * current template
     *
     * @type {KaTpl}
     */
    static get self() {
        return KaTpl.prototype.self;
    }

    static get observedAttributes() {
        return ["stmt", "debug"];
    }


    disconnectedCallback() {
        for (let el of this._els)
            this.parentElement.removeChild(el);
    }

    connectedCallback() {
        this._log("connectedCallback()", this);
        let auto = this.getAttribute("auto")
        if (auto !== null) {
            this._log("autostart: _init()", "document.readyState: ", document.readyState);

            let init = () => {
                this._init();
                if (auto === "")
                    this.render(this.$scope);
                else
                    eval(auto);
            };

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => {
                    init();
                })
            } else {
                init();
            }
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
        this._scope.$ref = this._refs;

        // Render only if dom available (allow <script> inside template to set scope before first rendering
        if ( ! this._isInitializing)
            this.render(this._scope);
    }

    get $scope() {
        let handler = {
            set: (target, property, value, receiver) => {
                //console.log ("set:", target, property, value);
                target[property] = value;
                // Don't update proxy during rendering (recursion)
                if ( ! this._isRendering) {
                    if (this._attrs.nodebounce === false) {
                        // Default behaviour: Debounce: So you can do multiple $scope updated with rending only once
                        if (this.__debounceTimeout !== null) {
                            window.clearTimeout(this.__debounceTimeout);
                            this.__debounceTimeout = null;
                        }
                        this.__debounceTimeout = window.setTimeout(() => {
                            this.render(this.$scope);
                        }, 10);
                    } else {
                        this.render(this.$scope);
                    }

                }
                return true;
            },
            get: (target, key) => {
                if (key === "$ref")
                    return this._refs;
                if (typeof target[key] === "object" && target[key] !== null)
                    return new Proxy(target[key], handler);
                return target[key];
            }

        };
        return new Proxy(this._scope, handler);
    }

    /**
     * Execute custom functions from outside the template
     *
     * <example>
     *     ka_tpl("tpl1").$fn.doSomething();
     * </example>
     *
     * @return {{customFn: (function(*): string)}|{}}
     */
    get $fn () {
        return this.$scope.$fn;
    }

    /**
     * Initialize the scope. Will return the proxied scope object.
     *
     * The proxy keeps track about changes to $scope and rerenders the
     * data then.
     *
     * So you can use the return value within the scope definition itself.
     *
     * <example>
     * let $scope = KaTpl.self.scopeInit({
     *     someData: [],
     *
     *     $fn: {
     *         update: () => {
     *             $scope.someData.push("Item")
     *         }
     *     }
     * });
     * </example>
     *
     * @param {{$fn:{}}} $scope
     * @return {Proxy<{}>}
     */
    scopeInit($scope) {
        this.$scope = $scope;
        return this.$scope; // <- Query scope over getter to receive proxy
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

        // Register self reference (see: KaTpl.self)
        KASELF = this;
        KaTpl.prototype.self = this;

        if (this._els === null) {
            this._appendElementsToParent();

        }

        this._isInitializing = false;
    }

    render($scope) {
        if (typeof $scope === "undefined")
            $scope = this.$scope;
        this._log("render($scope= ", $scope, ")");
        this._init();
        this._isRendering = true;
        for(let ce of this._els) {
            this.renderRecursive(ce, $scope);
        }
        this._isRendering = false;
    }
}

customElements.define("ka-tpl", KaTpl, {extends: "template"});
