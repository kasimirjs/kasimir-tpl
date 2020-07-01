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

        // Store ref/on/fn outside to allow setting $scope without overwriting them
        this._refs = {};
        this._on = {};
        this._fn = {};
        this._scope = {"$ref":this._refs, "$on": this._on, "$fn": this._fn};

        this.__debounceTimeout = null;
        this._handler = {};
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
        this._runTriggerFunction(this.$on.onBeforeDisconnect);
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

        // Set immutable data
        this._scope.$ref = this._refs;
        this._scope.$on = this._on;
        this._scope.$fn = this._fn;

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
                // Return direct link to immutable data
                switch (key) {
                    case "$ref":
                        return this._refs;
                    case "$on":
                        return this._on;
                    case "$fn":
                        return this._fn;
                }

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
     * Execute custom function on event
     *
     * @return {{
     *      onBeforeRender: (function($scope): void),
     *      onAfterRender: (function($scope): void),
     *      onAfterFirstRender: (function($scope): void)
     *      onBeforeDisconnect: (function($scope): void)
     *      }}
     */
    get $on () {
        return this.$scope.$on;
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
     * let $scope = KaTpl.self.scopeInit({someData: []});
     * </example>
     *
     * @param {{$fn:{}, $on:{}}} $scope
     * @return {Proxy<{}>}
     */
    scopeInit($scope) {
        if (typeof $scope.$fn !== "undefined")
            this._fn = $scope.$fn;
        if (typeof $scope.$on !== "undefined")
            this._on = $scope.$on;

        this.$scope = $scope;

        return this.$scope; // <- Query scope over getter to receive proxy
    }


    /**
     * Wait for a reference to be rendered
     *
     * Returns a promise that is resolved once the Referenced
     * Element (containing *ref attribute) in template and all its
     * child elements was rendered.
     *
     * If the element
     *
     * <example>
     *     <script>
     *          (async(self) =>  {

                    let input = await self.waitRef("input1");
                    console.log (input );
                })(KaTpl.self);
     *     </script>
     *     let elem = await self.waitRef("input1")
     * </example>
     *
     * @param name
     * @return {Promise}
     */
    waitRef(name) {
        if (typeof this.$scope.$ref[name] === "undefined") {
            var resolver;
            let p = new Promise(resolve => {
                resolver = resolve
            });
            p.resolve = function (value) {
                resolver(value);
            };
            this.$scope.$ref[name] = p;
            return p;
        }
        // Return immediate if reference already existing
        return Promise.resolve(this.$scope.$ref[name]);
    }

    /**
     * Verify if this is the first render attempt
     *
     * @return {boolean} True if first render
     * @private
     */
    _init() {
        if (this._els !== null)
            return false;
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
        return true;
    }

    _runTriggerFunction(fn) {
        if (typeof fn === "function")
            fn(this.$scope, this);
    }


    /**
     * Implicit render the template
     *
     *
     *
     * @param $scope {{}|null}
     */
    render($scope) {
        if (typeof $scope === "undefined")
            $scope = this.$scope;
        this._log("render($scope= ", $scope, ")");
        let isFirstRender = this._init();
        this._isRendering = true;

        // Important: run after _isRendering is true -> skip recursion
        this._runTriggerFunction(this.$on.onBeforeRender);

        for(let ce of this._els) {
            this.renderRecursive(ce, $scope);
        }

        // Execute $on callbacks
        if (isFirstRender) {
            this._runTriggerFunction(this.$on.onAfterFirstRender)
        }
        this._runTriggerFunction(this.$on.onAfterRender);
        this._isRendering = false;
    }
}

customElements.define("ka-tpl", KaTpl, {extends: "template"});
