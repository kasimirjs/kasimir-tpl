/**
 * Infracamp's Kasimir Templates
 *
 * A no-dependency render on request
 *
 * @licence
 * @see https://infracamp.org/project/kasimir
 * @author Matthias Leuffen <m@tth.es>
 */

class KtHelper {


    /**
     *
     * @param {string} stmt
     * @param {context} __scope
     * @param {HTMLElement} e
     * @return {any}
     */
    keval(stmt, __scope, e, __refs) {
        const reserved = ["var", "null", "let", "const", "function", "class", "in", "of", "for", "true", "false", "await", "$this"];
        let r = "var $this = e;";
        for (let __name in __scope) {
            if (reserved.indexOf(__name) !== -1)
                continue;
            r += `var ${__name} = __scope['${__name}'];`
        }
        // If the scope was cloned, the original will be in $scope. This is important when
        // Using events [on.click], e.g.
        if (typeof __scope.$scope === "undefined") {
            r += "var $scope = __scope;";
        }
        try {
            return eval(r + stmt)
        } catch (ex) {
            console.error("cannot eval() stmt: '" + stmt + "': " + ex + " on element ", e, "(context:", __scope, ")");
            throw "eval('" + stmt + "') failed: " + ex;
        }
    }

    /**
     * Returns a string to be eval()'ed registering
     * all the variables in scope to method context
     *
     * @param {object} $scope
     * @param {string} selector
     * @return {string}
     *
     */
    scopeEval($scope, selector, elem) {
        const reserved = ["var", "null", "let", "const", "function", "class", "in", "of", "for", "true", "false", "await", "$this"];
        let r = "var $this = elem;";
        for (let __name in $scope) {
            if (reserved.indexOf(__name) !== -1)
                continue;
            r += `var ${__name} = $scope['${__name}'];`
        }
        var __val = null;
        let s = `__val = ${selector};`;
        //console.log(r);
        try {
            eval(r + s);
        } catch (e) {
            console.error(`scopeEval('${s}') failed: ${e} on`, elem);
            throw `eval('${s}') failed: ${e}`;
        }
        return __val;
    }

    /**
     *  Find the first whitespaces in text and remove them from the
     *  start of the following lines.
     *
     *  @param {string} str
     *  @return {string}
     */
    unindentText(str) {
        let i = str.match(/\n(\s*)/m)[1];
        str = str.replace(new RegExp(`\n${i}`, "g"), "\n");
        str = str.trim();
        return str;
    }
}

var _KT_ELEMENT_ID = 0;

class KtRenderable extends HTMLTemplateElement {



    constructor() {
        super();
        /**
         *
         * @type {KtHelper}
         * @protected
         */
        this._hlpr = new KtHelper();

        /**
         * Array with all observed elements of this template
         *
         * null indicates, the template was not yet rendered
         *
         * @type {HTMLElement[]}
         * @protected
         */
        this._els = null;
        this._attrs = {"debug": false};

        /**
         * The internal element id to identify which elements
         * to render.
         *
         * @type {number}
         * @protected
         */
        this._ktId = ++_KT_ELEMENT_ID;
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this._attrs[attrName] = newVal;
    }

    _log(v1, v2, v3) {
        let a = [ this.constructor.name + "#" + this.id + "[" + this._ktId + "]:"];

        for (let e of arguments)
            a.push(e);

        if (this._attrs.debug !== false)
            console.log.apply(this, a);
    }


    /**
     * Walk through all elements and try to render them.
     *
     * if a element has the _kaMb (maintained by) property set,
     * check if it equals this._kaId (the element id). If not,
     * skip this node.
     *
     *
     * @param {HTMLElement} node
     * @param {object} $scope
     */
    renderRecursive(node, $scope) {
        if (node.hasOwnProperty("_kaMb") && node._kaMb !== this._ktId)
            return;

        let refPromise = null;

        // Register references
        if (node instanceof HTMLElement && node.hasAttribute("*ref")) {
            let refname = node.getAttribute("*ref");
            refPromise = $scope.$ref[refname];
            $scope.$ref[refname] = node;
        }

        // Register id of cloned node
        if (node instanceof HTMLElement && node.hasAttribute("*id")) {
            node.id = node.getAttribute("*id");
        }

        if (typeof node.render === "function") {
            node.render($scope);
            return;
        }

        for(let curNode of node.childNodes) {
            if (node.ktSkipRender === true)
                return;
            this.renderRecursive(curNode, $scope);
        }

        if (refPromise !== null && typeof refPromise !== "undefined" && typeof refPromise.resolve === "function") {
            // Resolve promise registered with waitRef()
            refPromise.resolve(node);
        }
    }

    _removeNodes() {
        if (this._els === null)
            return;
        for (let el of this._els) {
            if (typeof el._removeNodes === "function")
                el._removeNodes();
            if (this.parentElement !== null)
                this.parentElement.removeChild(el);
        }
        this._els = null;
    }

    /**
     * Clone and append all elements in
     * content of template to the next sibling.
     *
     * @param sibling
     * @protected
     */
    _appendElementsToParent(sibling) {
        if (typeof sibling === "undefined")
            sibling = this.nextSibling;

        let cn = this.content.cloneNode(true);
        this._els = [];
        for (let cel of cn.children) {
            cel._kaMb = this._ktId;
            this._els.push(cel);
        }

        this.parentElement.insertBefore(cn, sibling);

    }

}






class KtTemplateParser {


    /**
     *
     * @param text
     * @param {DocumentFragment} fragment
     * @return {null}
     * @private
     */
    _parseTextNode (text, fragment) {
        let split = text.split(/(\{\{|\}\})/);
        while(split.length > 0) {
            fragment.appendChild(new Text(split.shift()));
            if (split.length === 0)
                break;

            split.shift();
            let val = new KaVal();
            val.setAttribute("stmt", split.shift().trim());
            split.shift();
            fragment.appendChild(val);
        }
    }

    /**
     *
     * @param {HTMLElement} node
     */
    parseRecursive(node) {
        //console.log("[ka-tpl] parseRecursive(", node, ")");
        if (node instanceof DocumentFragment) {
            for (let n of node.children)
                this.parseRecursive(n);
            return;
        }

        if (node.tagName === "SCRIPT")
            return; // Don't parse beween <script></script> tags

        if (typeof node.getAttribute !== "function")
            return;

        if (node.ktParsed === true)
            return;

        node.ktParsed = true;

        for (let textNode of node.childNodes) {
            if (typeof textNode.data === "undefined")
                continue;
            let fragment = new DocumentFragment();
            this._parseTextNode(textNode.data, fragment);
            textNode.replaceWith(fragment);

        }

        if (node.hasAttribute("*for")) {
            let newNode = document.createElement("template", {is: "ka-loop"});
            let attr = node.getAttribute("*for");
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true);
            newNode.content.appendChild(cloneNode);

            let ma = attr.match(/let\s+(\S*)\s+(in|of|repeat)\s+(\S*)(\s+indexby\s+(\S*))?/);
            if (ma !== null) {
                newNode.setAttribute("formode", ma[2]);
                newNode.setAttribute("forselect", ma[3]);
                newNode.setAttribute("fordata", ma[1]);
                if (typeof ma[5] !== "undefined")
                    newNode.setAttribute("foridx", ma[5]);
                if (node.hasAttribute("*foreval")) {
                    newNode.setAttribute("foreval", node.getAttribute("*foreval"));
                }
            } else {
                throw "Cannot parse *for='" + attr + "' for element " + node.outerHTML;
            }

            node.replaceWith(newNode);
            node = cloneNode;
        }

        // If runs after *for (to filter for values)
        if (node.hasAttribute("*if")) {
            let newNode = document.createElement("template", {is: "kt-if"});
            let attr = node.getAttribute("*if");
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true);
            newNode.content.appendChild(cloneNode);
            newNode.setAttribute("stmt", attr);
            node.replaceWith(newNode);
            node = cloneNode;
        }

        let cssClasses = [];
        let ktClasses = null;
        let attrs = [];
        let events = {};
        let styles = [];

        let regex = new RegExp("^\\[(.+)\\]$");
        for(let attrName of node.getAttributeNames()) {

            let result = regex.exec(attrName);
            if (result === null)
                continue;

            let split = result[1].split(".");
            if (split.length === 1) {
                attrs.push(`'${split[0]}': ` + node.getAttribute(attrName));
            } else {
                switch (split[0]) {
                    case "classlist":
                        if (split[1] === "") {
                            ktClasses = node.getAttribute(attrName);
                            continue;
                        }

                        cssClasses.push(`'${split[1]}': ` + node.getAttribute(attrName));
                        break;

                    case "on":
                        events[split[1]] = node.getAttribute(attrName);
                        break;

                    case "style":
                        styles.push(`'${split[1]}': ` + node.getAttribute(attrName));
                        break;

                    default:
                        console.warn("Invalid attribute '" + attrName + "'")
                }
            }
        }

        if (attrs.length > 0 || cssClasses.length > 0 || ktClasses !== null || Object.keys(events).length > 0 || styles.length > 0) {
            let newNode = document.createElement("template", {is: "kt-maintain"});
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true);
            newNode.content.appendChild(cloneNode);


            if (attrs.length > 0)
                cloneNode.setAttribute("kt-attrs", "{" + attrs.join(",") + "}");

            if (styles.length > 0)
                cloneNode.setAttribute("kt-styles", "{" + styles.join(",") + "}");

            if (ktClasses !== null) {
                // include [classlist.]="{class: cond}"
                cloneNode.setAttribute("kt-classes", ktClasses);
            } else if (cssClasses.length > 0) {
                cloneNode.setAttribute("kt-classes", "{" + cssClasses.join(",") + "}");
            }

            if (Object.keys(events).length > 0)
                cloneNode.setAttribute("kt-on", JSON.stringify(events));

            node.replaceWith(newNode);
            node = cloneNode;
        }



        for (let curNode of node.children)
            this.parseRecursive(curNode);



    }

}
/**
 *
 * @return KaTpl
 */
function ka_tpl(selector) {
    if (selector instanceof KaTpl)
        return selector;
    let elem = document.getElementById(selector);
    if (elem instanceof KaTpl) {
        return elem;
    }
    throw `Selector '${selector}' is not a <template is="ka-tpl"> element`;
}



var KT_FN = {
    /**
     *
     * @param {HTMLElement} elem
     * @param {string} val
     * @param scope
     */
    "kt-classes": function(elem, val, scope) {
        "use strict";

        let kthelper = new KtHelper();
        let classes = kthelper.scopeEval(scope, val, elem);
        for (let className in classes) {
            if ( ! classes.hasOwnProperty(className))
                continue;
            if (classes[className] === true) {
                elem.classList.add(className);
            } else {
                elem.classList.remove(className);
            }
        }
    },

    /**
     *
     * @param {HTMLElement} elem
     * @param {string} val
     * @param scope
     */
    "kt-styles": function(elem, val, scope) {
        "use strict";

        let kthelper = new KtHelper();
        let styles = kthelper.scopeEval(scope, val, elem);
        for (let styleName in styles) {
            if ( ! styles.hasOwnProperty(styleName))
                continue;
            if (styles[styleName] === null) {
                elem.style.removeProperty(styleName);
            } else {
                elem.style.setProperty(styleName, styles[styleName]);
            }
        }
    },

    "kt-attrs": function (elem, val, scope) {
        let kthelper = new KtHelper();
        let classes = kthelper.scopeEval(scope, val, elem);
        for (let className in classes) {
            if ( ! classes.hasOwnProperty(className))
                continue;
            if (classes[className] !== null && classes[className] !== false) {
                elem.setAttribute(className, classes[className]);
            } else {
                elem.removeAttribute(className);
            }
        }
    },
    "kt-on": function (elem, val, $scope) {
        let kthelper = new KtHelper();

        // Clone the first layer of the scope so it can be evaluated on event
        let saveScope = {...$scope};
        saveScope.$scope = $scope;
        //saveScope.$ref = $scope.$ref;

        let events = JSON.parse(val);
        for (let event in events) {
            elem["on" + event] = (e) => {
                kthelper.keval(events[event], saveScope, elem);
                return false;
            }
        }

    }
};


class KaInclude extends KtRenderable {


    constructor() {
        super();
        this._attrs = {
            "src": null,
            "auto": null,
            "raw": null,
            "debug": false
        }
    }

    static get observedAttributes() {
        return ["src", "debug", "auto", "raw"];
    }


    /**
     * <script> tags that were loaded via ajax won't be executed
     * when added to dom.
     *
     * Therefore we have to rewrite them. This method does this
     * automatically both for normal and for template (content) nodes.
     *
     * @param node
     * @private
     */
    _importScritpRecursive(node) {
        let chels = node instanceof HTMLTemplateElement ? node.content.childNodes : node.childNodes;

        for (let s of chels) {
            if (s.tagName !== "SCRIPT") {
                this._importScritpRecursive(s);
                continue;
            }
            let n = document.createElement("script");
            n.innerHTML = s.innerHTML;
            s.replaceWith(n);
        }
    }


    _loadDataRemote() {
        let xhttp = new XMLHttpRequest();

        xhttp.open("GET", this._attrs.src);
        xhttp.onreadystatechange = () => {
            if (xhttp.readyState === 4) {
                if (xhttp.status >= 400) {
                    console.warn("Can't load '" + this.params.src + "': " + xhttp.responseText);
                    return;
                }
                this.innerHTML = xhttp.responseText;
                if (this._attrs.raw !== null) {
                    let p = new KtTemplateParser();
                    p.parseRecursive(this.content);
                }

                // Nodes loaded from remote won't get executed. So import them.
                this._importScritpRecursive(this.content);

                this._appendElementsToParent();
                for (let el of this._els) {
                    this._log("trigger DOMContentLoaded event on", el);
                    el.dispatchEvent(new Event("DOMContentLoaded"));
                }
                return;
            }

        };

        xhttp.send();
    }

    disconnectedCallback() {
        for (let el of this._els)
            this.parentElement.removeChild(el);
    }

    connectedCallback() {
        let auto = this.getAttribute("auto");
        if (auto !== null) {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => {
                    this._loadDataRemote();
                });
            } else {
                this._loadDataRemote();
            }
        }
    }

    render(context) {
        if (this._els === null)
            this._appendElementsToParent();


    }
}

customElements.define("ka-include", KaInclude, {extends: "template"});



class KaLoop extends KtRenderable {


    constructor() {
        super();
        this._origSibling = false;
        this._attrs = {
            "forselect": null,
            "formode": null,
            "foridx": null,
            "fordata": null,
            "foreval": null
        }
        this._els = [];
    }

    static get observedAttributes() {
        return ["forselect", "foridx", "fordata", "foreval", "formode"];
    }


    _appendElem() {
        let newNode = this.content.cloneNode(true);
        let nodes = [];
        for (let curNode of newNode.children) {
            curNode._kaMb = this._ktId;
            nodes.push(curNode);
        }
        for (let i = 0; i < nodes.length; i++)
            this.parentElement.insertBefore(nodes[i], this._origSibling);
        this._els.push({
            node: nodes
        });
    }


    _maintainNode(i, $scope) {
        if (this._els.length < i+1)
            this._appendElem();
        if (this._attrs.foridx !== null)
            $scope[this._attrs.foridx] = i;

        if (this._attrs.foreval !== null)
            this._hlpr.keval(this._attrs.foreval, $scope, this);

        for (let curNode of this._els[i].node) {
            this.renderRecursive(curNode, $scope);
        }
    }


    render($scope) {
        let _a_sel = this._attrs.forselect;
        let sel = this._hlpr.scopeEval($scope, _a_sel, this);

        if (this._attrs.formode !== "repeat") {

            if (typeof sel !== "object") {
                console.warn(`Invalid forSelect="${_a_sel}" returned:`, sel, "on context", context, "(Element: ", this, ")");
                throw "Invalid forSelect selector. see waring."
            }

            if (sel === null || (typeof sel[Symbol.iterator] !== "function" && typeof sel !== 'object') ) {
                this._log(`Selector '${_a_sel}' in for statement is not iterable. Returned value: `, sel, "in", this);
                console.warn(`Selector '${_a_sel}' in for statement is not iterable. Returned value: `, sel, "in", this)
                return;
            }
        } else {
            if (typeof sel !== "number") {
                this._log(`Selector '${_a_sel}' in for statement is a number. Returned value: `, sel, "in", this);
                console.warn(`Selector '${_a_sel}' in for statement is a number. Returned value: `, sel, "in", this)
                return;
            }
        }

        if (this._origSibling === false)
            this._origSibling = this.nextSibling;


        let n = 0;
        switch (this._attrs.formode) {
            case "in":
                n = 0;
                for(let i in sel) {
                    $scope[this._attrs.fordata] = i;
                    this._maintainNode(n, $scope);
                    n++;
                }
                break;

            case "of":
                n = 0;
                for (let i of sel) {

                    $scope[this._attrs.fordata] = i;
                    this._maintainNode(n, $scope);
                    n++;
                }
                break;

            case "repeat":
                for (n=0; n < sel; n++) {
                    $scope[this._attrs.fordata] = n;
                    this._maintainNode(n, $scope);
                }
                break;
            default:
                throw "Invalid for type '" + this._attrs.formode + "' in " . this.outerHTML;
        }


        for (let idx = n; sel.length < this._els.length; idx++) {
            let elem = this._els.pop();
            for (let curNode of elem.node) {
                if (typeof curNode._removeNodes === "function")
                    curNode._removeNodes();
                this.parentElement.removeChild(curNode);
            }
        }
    }
}

customElements.define("ka-loop", KaLoop, {extends: "template"});
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

class KaVal extends HTMLElement {


    constructor() {
        super();
        /**
         *
         * @type {KtHelper}
         * @private
         */
        this._ktHlpr = new KtHelper();
        this._attrs = {
            "debug": false,
            "stmt": null,
            "afterrender": null
        }
    }

    static get observedAttributes() {
        return ["stmt", "afterrender", "debug"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this._attrs[attrName] = newVal;
    }

    connectedCallback() {
        if (this.hasAttribute("auto"))
            this.render({});
    }
    _log() {
        if (this._attrs.debug !== false) {

            console.log.apply(this, arguments);
        }

    }
    render($scope) {
        this._log(`render(`, $scope, `) on '${this.outerHTML}'`);
        try {

            let v = this._ktHlpr.scopeEval($scope, this._attrs.stmt);
            if (typeof v === "object")
                v = JSON.stringify(v);

            if (this.hasAttribute("unindent")) {
                v = this._ktHlpr.unindentText(v);
            }

            if (this.hasAttribute("html")) {
                this.innerHTML = v;
            } else {
                this.innerText = v;
            }
            if (this._attrs.afterrender !== null)
                eval(this._attrs.afterrender)
        } catch (e) {
            this.innerText = e;
        }
    }
}

customElements.define("ka-val", KaVal);



class KtIf extends KtRenderable {
    constructor() {
        super();
        this._attrs = {
            "stmt": null
        }
    }

    static get observedAttributes() {
        return ["stmt"];
    }

    render($scope) {
        let isTrue = this._hlpr.scopeEval($scope, this._attrs.stmt);

        if ( ! isTrue) {
            this._removeNodes();
            return;
        }
        if (this._els === null) {
            this._appendElementsToParent();
        }

        for (let curNode of this._els)
            this.renderRecursive(curNode, $scope);
    }
}

customElements.define("kt-if", KtIf, {extends: "template"});



class KtMaintain extends KtRenderable {


    constructor() {
        super();
        this._attrs = {
            "stmt": null,
            "debug": false
        }
    }

    static get observedAttributes() {
        return ["stmt", "debug"];
    }


    disconnectedCallback() {
        this._removeNodes();
    }

    render($scope) {
        if (this._els === null) {
            this._appendElementsToParent()
        }

        for (let curElement of this._els) {
            if ( typeof curElement.hasAttribute !== "function")
                continue;
            for (let attrName in KT_FN) {
                if ( ! curElement.hasAttribute(attrName))
                    continue;
                KT_FN[attrName](curElement, curElement.getAttribute(attrName), $scope);
            }
            this.renderRecursive(curElement, $scope, true);
        }
    }
}

customElements.define("kt-maintain", KtMaintain, {extends: "template"});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoia2FzaW1pci10cGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJcbmNsYXNzIEt0SGVscGVyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RtdFxuICAgICAqIEBwYXJhbSB7Y29udGV4dH0gX19zY29wZVxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgX19zY29wZSwgZSwgX19yZWZzKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIiwgXCJhd2FpdFwiLCBcIiR0aGlzXCJdO1xuICAgICAgICBsZXQgciA9IFwidmFyICR0aGlzID0gZTtcIjtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluIF9fc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9IF9fc2NvcGVbJyR7X19uYW1lfSddO2BcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiB0aGUgc2NvcGUgd2FzIGNsb25lZCwgdGhlIG9yaWdpbmFsIHdpbGwgYmUgaW4gJHNjb3BlLiBUaGlzIGlzIGltcG9ydGFudCB3aGVuXG4gICAgICAgIC8vIFVzaW5nIGV2ZW50cyBbb24uY2xpY2tdLCBlLmcuXG4gICAgICAgIGlmICh0eXBlb2YgX19zY29wZS4kc2NvcGUgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHIgKz0gXCJ2YXIgJHNjb3BlID0gX19zY29wZTtcIjtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGV2YWwociArIHN0bXQpXG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiY2Fubm90IGV2YWwoKSBzdG10OiAnXCIgKyBzdG10ICsgXCInOiBcIiArIGV4ICsgXCIgb24gZWxlbWVudCBcIiwgZSwgXCIoY29udGV4dDpcIiwgX19zY29wZSwgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJldmFsKCdcIiArIHN0bXQgKyBcIicpIGZhaWxlZDogXCIgKyBleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBzdHJpbmcgdG8gYmUgZXZhbCgpJ2VkIHJlZ2lzdGVyaW5nXG4gICAgICogYWxsIHRoZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gbWV0aG9kIGNvbnRleHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKi9cbiAgICBzY29wZUV2YWwoJHNjb3BlLCBzZWxlY3RvciwgZWxlbSkge1xuICAgICAgICBjb25zdCByZXNlcnZlZCA9IFtcInZhclwiLCBcIm51bGxcIiwgXCJsZXRcIiwgXCJjb25zdFwiLCBcImZ1bmN0aW9uXCIsIFwiY2xhc3NcIiwgXCJpblwiLCBcIm9mXCIsIFwiZm9yXCIsIFwidHJ1ZVwiLCBcImZhbHNlXCIsIFwiYXdhaXRcIiwgXCIkdGhpc1wiXTtcbiAgICAgICAgbGV0IHIgPSBcInZhciAkdGhpcyA9IGVsZW07XCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIHZhciBfX3ZhbCA9IG51bGw7XG4gICAgICAgIGxldCBzID0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV2YWwociArIHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBzY29wZUV2YWwoJyR7c30nKSBmYWlsZWQ6ICR7ZX0gb25gLCBlbGVtKTtcbiAgICAgICAgICAgIHRocm93IGBldmFsKCcke3N9JykgZmFpbGVkOiAke2V9YDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX192YWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogIEZpbmQgdGhlIGZpcnN0IHdoaXRlc3BhY2VzIGluIHRleHQgYW5kIHJlbW92ZSB0aGVtIGZyb20gdGhlXG4gICAgICogIHN0YXJ0IG9mIHRoZSBmb2xsb3dpbmcgbGluZXMuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtzdHJpbmd9IHN0clxuICAgICAqICBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICovXG4gICAgdW5pbmRlbnRUZXh0KHN0cikge1xuICAgICAgICBsZXQgaSA9IHN0ci5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZShuZXcgUmVnRXhwKGBcXG4ke2l9YCwgXCJnXCIpLCBcIlxcblwiKTtcbiAgICAgICAgc3RyID0gc3RyLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG59IiwiXG52YXIgX0tUX0VMRU1FTlRfSUQgPSAwO1xuXG5jbGFzcyBLdFJlbmRlcmFibGUgZXh0ZW5kcyBIVE1MVGVtcGxhdGVFbGVtZW50IHtcblxuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faGxwciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSB3aXRoIGFsbCBvYnNlcnZlZCBlbGVtZW50cyBvZiB0aGlzIHRlbXBsYXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIG51bGwgaW5kaWNhdGVzLCB0aGUgdGVtcGxhdGUgd2FzIG5vdCB5ZXQgcmVuZGVyZWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0hUTUxFbGVtZW50W119XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VscyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1wiZGVidWdcIjogZmFsc2V9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgaW50ZXJuYWwgZWxlbWVudCBpZCB0byBpZGVudGlmeSB3aGljaCBlbGVtZW50c1xuICAgICAgICAgKiB0byByZW5kZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SWQgPSArK19LVF9FTEVNRU5UX0lEO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5fYXR0cnNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIF9sb2codjEsIHYyLCB2Mykge1xuICAgICAgICBsZXQgYSA9IFsgdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIjXCIgKyB0aGlzLmlkICsgXCJbXCIgKyB0aGlzLl9rdElkICsgXCJdOlwiXTtcblxuICAgICAgICBmb3IgKGxldCBlIG9mIGFyZ3VtZW50cylcbiAgICAgICAgICAgIGEucHVzaChlKTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZGVidWcgIT09IGZhbHNlKVxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBXYWxrIHRocm91Z2ggYWxsIGVsZW1lbnRzIGFuZCB0cnkgdG8gcmVuZGVyIHRoZW0uXG4gICAgICpcbiAgICAgKiBpZiBhIGVsZW1lbnQgaGFzIHRoZSBfa2FNYiAobWFpbnRhaW5lZCBieSkgcHJvcGVydHkgc2V0LFxuICAgICAqIGNoZWNrIGlmIGl0IGVxdWFscyB0aGlzLl9rYUlkICh0aGUgZWxlbWVudCBpZCkuIElmIG5vdCxcbiAgICAgKiBza2lwIHRoaXMgbm9kZS5cbiAgICAgKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKi9cbiAgICByZW5kZXJSZWN1cnNpdmUobm9kZSwgJHNjb3BlKSB7XG4gICAgICAgIGlmIChub2RlLmhhc093blByb3BlcnR5KFwiX2thTWJcIikgJiYgbm9kZS5fa2FNYiAhPT0gdGhpcy5fa3RJZClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBsZXQgcmVmUHJvbWlzZSA9IG51bGw7XG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgcmVmZXJlbmNlc1xuICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmIG5vZGUuaGFzQXR0cmlidXRlKFwiKnJlZlwiKSkge1xuICAgICAgICAgICAgbGV0IHJlZm5hbWUgPSBub2RlLmdldEF0dHJpYnV0ZShcIipyZWZcIik7XG4gICAgICAgICAgICByZWZQcm9taXNlID0gJHNjb3BlLiRyZWZbcmVmbmFtZV07XG4gICAgICAgICAgICAkc2NvcGUuJHJlZltyZWZuYW1lXSA9IG5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWdpc3RlciBpZCBvZiBjbG9uZWQgbm9kZVxuICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmIG5vZGUuaGFzQXR0cmlidXRlKFwiKmlkXCIpKSB7XG4gICAgICAgICAgICBub2RlLmlkID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqaWRcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG5vZGUucmVuZGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyKCRzY29wZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5rdFNraXBSZW5kZXIgPT09IHRydWUpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZWZQcm9taXNlICE9PSBudWxsICYmIHR5cGVvZiByZWZQcm9taXNlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiByZWZQcm9taXNlLnJlc29sdmUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgLy8gUmVzb2x2ZSBwcm9taXNlIHJlZ2lzdGVyZWQgd2l0aCB3YWl0UmVmKClcbiAgICAgICAgICAgIHJlZlByb21pc2UucmVzb2x2ZShub2RlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW1vdmVOb2RlcygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGVsLl9yZW1vdmVOb2RlcyA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgIGVsLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgaWYgKHRoaXMucGFyZW50RWxlbWVudCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VscyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvbmUgYW5kIGFwcGVuZCBhbGwgZWxlbWVudHMgaW5cbiAgICAgKiBjb250ZW50IG9mIHRlbXBsYXRlIHRvIHRoZSBuZXh0IHNpYmxpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gc2libGluZ1xuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKi9cbiAgICBfYXBwZW5kRWxlbWVudHNUb1BhcmVudChzaWJsaW5nKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2libGluZyA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgIHNpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG4gICAgICAgIGxldCBjbiA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBjZWwgb2YgY24uY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGNlbC5fa2FNYiA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICB0aGlzLl9lbHMucHVzaChjZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShjbiwgc2libGluZyk7XG5cbiAgICB9XG5cbn1cblxuXG5cbiIsIlxuXG5jbGFzcyBLdFRlbXBsYXRlUGFyc2VyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdGV4dFxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ21lbnRcbiAgICAgKiBAcmV0dXJuIHtudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlVGV4dE5vZGUgKHRleHQsIGZyYWdtZW50KSB7XG4gICAgICAgIGxldCBzcGxpdCA9IHRleHQuc3BsaXQoLyhcXHtcXHt8XFx9XFx9KS8pO1xuICAgICAgICB3aGlsZShzcGxpdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChuZXcgVGV4dChzcGxpdC5zaGlmdCgpKSk7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgbGV0IHZhbCA9IG5ldyBLYVZhbCgpO1xuICAgICAgICAgICAgdmFsLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgc3BsaXQuc2hpZnQoKS50cmltKCkpO1xuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHZhbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcbiAgICAgKi9cbiAgICBwYXJzZVJlY3Vyc2l2ZShub2RlKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJba2EtdHBsXSBwYXJzZVJlY3Vyc2l2ZShcIiwgbm9kZSwgXCIpXCIpO1xuICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIERvY3VtZW50RnJhZ21lbnQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IG4gb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKG4pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUudGFnTmFtZSA9PT0gXCJTQ1JJUFRcIilcbiAgICAgICAgICAgIHJldHVybjsgLy8gRG9uJ3QgcGFyc2UgYmV3ZWVuIDxzY3JpcHQ+PC9zY3JpcHQ+IHRhZ3NcblxuICAgICAgICBpZiAodHlwZW9mIG5vZGUuZ2V0QXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKG5vZGUua3RQYXJzZWQgPT09IHRydWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbm9kZS5rdFBhcnNlZCA9IHRydWU7XG5cbiAgICAgICAgZm9yIChsZXQgdGV4dE5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRleHROb2RlLmRhdGEgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBsZXQgZnJhZ21lbnQgPSBuZXcgRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VUZXh0Tm9kZSh0ZXh0Tm9kZS5kYXRhLCBmcmFnbWVudCk7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5yZXBsYWNlV2l0aChmcmFnbWVudCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrYS1sb29wXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqZm9yXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG5cbiAgICAgICAgICAgIGxldCBtYSA9IGF0dHIubWF0Y2goL2xldFxccysoXFxTKilcXHMrKGlufG9mfHJlcGVhdClcXHMrKFxcUyopKFxccytpbmRleGJ5XFxzKyhcXFMqKSk/Lyk7XG4gICAgICAgICAgICBpZiAobWEgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcm1vZGVcIiwgbWFbMl0pO1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yc2VsZWN0XCIsIG1hWzNdKTtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmRhdGFcIiwgbWFbMV0pO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbWFbNV0gIT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yaWR4XCIsIG1hWzVdKTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yZXZhbFwiKSkge1xuICAgICAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmV2YWxcIiwgbm9kZS5nZXRBdHRyaWJ1dGUoXCIqZm9yZXZhbFwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkNhbm5vdCBwYXJzZSAqZm9yPSdcIiArIGF0dHIgKyBcIicgZm9yIGVsZW1lbnQgXCIgKyBub2RlLm91dGVySFRNTDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBydW5zIGFmdGVyICpmb3IgKHRvIGZpbHRlciBmb3IgdmFsdWVzKVxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqaWZcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1pZlwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmlmXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgYXR0cik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjc3NDbGFzc2VzID0gW107XG4gICAgICAgIGxldCBrdENsYXNzZXMgPSBudWxsO1xuICAgICAgICBsZXQgYXR0cnMgPSBbXTtcbiAgICAgICAgbGV0IGV2ZW50cyA9IHt9O1xuICAgICAgICBsZXQgc3R5bGVzID0gW107XG5cbiAgICAgICAgbGV0IHJlZ2V4ID0gbmV3IFJlZ0V4cChcIl5cXFxcWyguKylcXFxcXSRcIik7XG4gICAgICAgIGZvcihsZXQgYXR0ck5hbWUgb2Ygbm9kZS5nZXRBdHRyaWJ1dGVOYW1lcygpKSB7XG5cbiAgICAgICAgICAgIGxldCByZXN1bHQgPSByZWdleC5leGVjKGF0dHJOYW1lKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGxldCBzcGxpdCA9IHJlc3VsdFsxXS5zcGxpdChcIi5cIik7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgYXR0cnMucHVzaChgJyR7c3BsaXRbMF19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoc3BsaXRbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImNsYXNzbGlzdFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNwbGl0WzFdID09PSBcIlwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga3RDbGFzc2VzID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjc3NDbGFzc2VzLnB1c2goYCcke3NwbGl0WzFdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm9uXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudHNbc3BsaXRbMV1dID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInN0eWxlXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiSW52YWxpZCBhdHRyaWJ1dGUgJ1wiICsgYXR0ck5hbWUgKyBcIidcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMCB8fCBjc3NDbGFzc2VzLmxlbmd0aCA+IDAgfHwga3RDbGFzc2VzICE9PSBudWxsIHx8IE9iamVjdC5rZXlzKGV2ZW50cykubGVuZ3RoID4gMCB8fCBzdHlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LW1haW50YWluXCJ9KTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuXG5cbiAgICAgICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1hdHRyc1wiLCBcIntcIiArIGF0dHJzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuXG4gICAgICAgICAgICBpZiAoc3R5bGVzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LXN0eWxlc1wiLCBcIntcIiArIHN0eWxlcy5qb2luKFwiLFwiKSArIFwifVwiKTtcblxuICAgICAgICAgICAgaWYgKGt0Q2xhc3NlcyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vIGluY2x1ZGUgW2NsYXNzbGlzdC5dPVwie2NsYXNzOiBjb25kfVwiXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWNsYXNzZXNcIiwga3RDbGFzc2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWNsYXNzZXNcIiwgXCJ7XCIgKyBjc3NDbGFzc2VzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZXZlbnRzKS5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1vblwiLCBKU09OLnN0cmluZ2lmeShldmVudHMpKTtcblxuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShjdXJOb2RlKTtcblxuXG5cbiAgICB9XG5cbn0iLCIvKipcbiAqXG4gKiBAcmV0dXJuIEthVHBsXG4gKi9cbmZ1bmN0aW9uIGthX3RwbChzZWxlY3Rvcikge1xuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEthVHBsKVxuICAgICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgbGV0IGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3Rvcik7XG4gICAgaWYgKGVsZW0gaW5zdGFuY2VvZiBLYVRwbCkge1xuICAgICAgICByZXR1cm4gZWxlbTtcbiAgICB9XG4gICAgdGhyb3cgYFNlbGVjdG9yICcke3NlbGVjdG9yfScgaXMgbm90IGEgPHRlbXBsYXRlIGlzPVwia2EtdHBsXCI+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IGNsYXNzZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCwgZWxlbSk7XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsXG4gICAgICogQHBhcmFtIHNjb3BlXG4gICAgICovXG4gICAgXCJrdC1zdHlsZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IHN0eWxlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsLCBlbGVtKTtcbiAgICAgICAgZm9yIChsZXQgc3R5bGVOYW1lIGluIHN0eWxlcykge1xuICAgICAgICAgICAgaWYgKCAhIHN0eWxlcy5oYXNPd25Qcm9wZXJ0eShzdHlsZU5hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKHN0eWxlc1tzdHlsZU5hbWVdID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zdHlsZS5yZW1vdmVQcm9wZXJ0eShzdHlsZU5hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLnN0eWxlLnNldFByb3BlcnR5KHN0eWxlTmFtZSwgc3R5bGVzW3N0eWxlTmFtZV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIFwia3QtYXR0cnNcIjogZnVuY3Rpb24gKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBjbGFzc2VzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwsIGVsZW0pO1xuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gIT09IG51bGwgJiYgY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKGNsYXNzTmFtZSwgY2xhc3Nlc1tjbGFzc05hbWVdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5yZW1vdmVBdHRyaWJ1dGUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJrdC1vblwiOiBmdW5jdGlvbiAoZWxlbSwgdmFsLCAkc2NvcGUpIHtcbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLy8gQ2xvbmUgdGhlIGZpcnN0IGxheWVyIG9mIHRoZSBzY29wZSBzbyBpdCBjYW4gYmUgZXZhbHVhdGVkIG9uIGV2ZW50XG4gICAgICAgIGxldCBzYXZlU2NvcGUgPSB7Li4uJHNjb3BlfTtcbiAgICAgICAgc2F2ZVNjb3BlLiRzY29wZSA9ICRzY29wZTtcbiAgICAgICAgLy9zYXZlU2NvcGUuJHJlZiA9ICRzY29wZS4kcmVmO1xuXG4gICAgICAgIGxldCBldmVudHMgPSBKU09OLnBhcnNlKHZhbCk7XG4gICAgICAgIGZvciAobGV0IGV2ZW50IGluIGV2ZW50cykge1xuICAgICAgICAgICAgZWxlbVtcIm9uXCIgKyBldmVudF0gPSAoZSkgPT4ge1xuICAgICAgICAgICAgICAgIGt0aGVscGVyLmtldmFsKGV2ZW50c1tldmVudF0sIHNhdmVTY29wZSwgZWxlbSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9XG59OyIsIlxuXG5jbGFzcyBLYUluY2x1ZGUgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcInNyY1wiOiBudWxsLFxuICAgICAgICAgICAgXCJhdXRvXCI6IG51bGwsXG4gICAgICAgICAgICBcInJhd1wiOiBudWxsLFxuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzcmNcIiwgXCJkZWJ1Z1wiLCBcImF1dG9cIiwgXCJyYXdcIl07XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiA8c2NyaXB0PiB0YWdzIHRoYXQgd2VyZSBsb2FkZWQgdmlhIGFqYXggd29uJ3QgYmUgZXhlY3V0ZWRcbiAgICAgKiB3aGVuIGFkZGVkIHRvIGRvbS5cbiAgICAgKlxuICAgICAqIFRoZXJlZm9yZSB3ZSBoYXZlIHRvIHJld3JpdGUgdGhlbS4gVGhpcyBtZXRob2QgZG9lcyB0aGlzXG4gICAgICogYXV0b21hdGljYWxseSBib3RoIGZvciBub3JtYWwgYW5kIGZvciB0ZW1wbGF0ZSAoY29udGVudCkgbm9kZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbm9kZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2ltcG9ydFNjcml0cFJlY3Vyc2l2ZShub2RlKSB7XG4gICAgICAgIGxldCBjaGVscyA9IG5vZGUgaW5zdGFuY2VvZiBIVE1MVGVtcGxhdGVFbGVtZW50ID8gbm9kZS5jb250ZW50LmNoaWxkTm9kZXMgOiBub2RlLmNoaWxkTm9kZXM7XG5cbiAgICAgICAgZm9yIChsZXQgcyBvZiBjaGVscykge1xuICAgICAgICAgICAgaWYgKHMudGFnTmFtZSAhPT0gXCJTQ1JJUFRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltcG9ydFNjcml0cFJlY3Vyc2l2ZShzKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKTtcbiAgICAgICAgICAgIG4uaW5uZXJIVE1MID0gcy5pbm5lckhUTUw7XG4gICAgICAgICAgICBzLnJlcGxhY2VXaXRoKG4pO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBfbG9hZERhdGFSZW1vdGUoKSB7XG4gICAgICAgIGxldCB4aHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIHhodHRwLm9wZW4oXCJHRVRcIiwgdGhpcy5fYXR0cnMuc3JjKTtcbiAgICAgICAgeGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHhodHRwLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGh0dHAuc3RhdHVzID49IDQwMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJDYW4ndCBsb2FkICdcIiArIHRoaXMucGFyYW1zLnNyYyArIFwiJzogXCIgKyB4aHR0cC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0geGh0dHAucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hdHRycy5yYXcgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHAgPSBuZXcgS3RUZW1wbGF0ZVBhcnNlcigpO1xuICAgICAgICAgICAgICAgICAgICBwLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gTm9kZXMgbG9hZGVkIGZyb20gcmVtb3RlIHdvbid0IGdldCBleGVjdXRlZC4gU28gaW1wb3J0IHRoZW0uXG4gICAgICAgICAgICAgICAgdGhpcy5faW1wb3J0U2NyaXRwUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvZyhcInRyaWdnZXIgRE9NQ29udGVudExvYWRlZCBldmVudCBvblwiLCBlbCk7XG4gICAgICAgICAgICAgICAgICAgIGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KFwiRE9NQ29udGVudExvYWRlZFwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuXG4gICAgICAgIHhodHRwLnNlbmQoKTtcbiAgICB9XG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgbGV0IGF1dG8gPSB0aGlzLmdldEF0dHJpYnV0ZShcImF1dG9cIik7XG4gICAgICAgIGlmIChhdXRvICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvYWREYXRhUmVtb3RlKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2xvYWREYXRhUmVtb3RlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuXG5cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLWluY2x1ZGVcIiwgS2FJbmNsdWRlLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS2FMb29wIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX29yaWdTaWJsaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJmb3JzZWxlY3RcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9ybW9kZVwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JpZHhcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yZGF0YVwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JldmFsXCI6IG51bGxcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcImZvcnNlbGVjdFwiLCBcImZvcmlkeFwiLCBcImZvcmRhdGFcIiwgXCJmb3JldmFsXCIsIFwiZm9ybW9kZVwiXTtcbiAgICB9XG5cblxuICAgIF9hcHBlbmRFbGVtKCkge1xuICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIGxldCBub2RlcyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGN1ck5vZGUuX2thTWIgPSB0aGlzLl9rdElkO1xuICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShub2Rlc1tpXSwgdGhpcy5fb3JpZ1NpYmxpbmcpO1xuICAgICAgICB0aGlzLl9lbHMucHVzaCh7XG4gICAgICAgICAgICBub2RlOiBub2Rlc1xuICAgICAgICB9KTtcbiAgICB9XG5cblxuICAgIF9tYWludGFpbk5vZGUoaSwgJHNjb3BlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMubGVuZ3RoIDwgaSsxKVxuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbSgpO1xuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZm9yaWR4ICE9PSBudWxsKVxuICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmlkeF0gPSBpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3JldmFsICE9PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5faGxwci5rZXZhbCh0aGlzLl9hdHRycy5mb3JldmFsLCAkc2NvcGUsIHRoaXMpO1xuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzW2ldLm5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgbGV0IF9hX3NlbCA9IHRoaXMuX2F0dHJzLmZvcnNlbGVjdDtcbiAgICAgICAgbGV0IHNlbCA9IHRoaXMuX2hscHIuc2NvcGVFdmFsKCRzY29wZSwgX2Ffc2VsLCB0aGlzKTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZm9ybW9kZSAhPT0gXCJyZXBlYXRcIikge1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHNlbCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgSW52YWxpZCBmb3JTZWxlY3Q9XCIke19hX3NlbH1cIiByZXR1cm5lZDpgLCBzZWwsIFwib24gY29udGV4dFwiLCBjb250ZXh0LCBcIihFbGVtZW50OiBcIiwgdGhpcywgXCIpXCIpO1xuICAgICAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCBmb3JTZWxlY3Qgc2VsZWN0b3IuIHNlZSB3YXJpbmcuXCJcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNlbCA9PT0gbnVsbCB8fCAodHlwZW9mIHNlbFtTeW1ib2wuaXRlcmF0b3JdICE9PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIHNlbCAhPT0gJ29iamVjdCcpICkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2xvZyhgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIG5vdCBpdGVyYWJsZS4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc2VsICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9nKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIGEgbnVtYmVyLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBhIG51bWJlci4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLl9vcmlnU2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cblxuICAgICAgICBsZXQgbiA9IDA7XG4gICAgICAgIHN3aXRjaCAodGhpcy5fYXR0cnMuZm9ybW9kZSkge1xuICAgICAgICAgICAgY2FzZSBcImluXCI6XG4gICAgICAgICAgICAgICAgbiA9IDA7XG4gICAgICAgICAgICAgICAgZm9yKGxldCBpIGluIHNlbCkge1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgbisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcIm9mXCI6XG4gICAgICAgICAgICAgICAgbiA9IDA7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSBvZiBzZWwpIHtcblxuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgbisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcInJlcGVhdFwiOlxuICAgICAgICAgICAgICAgIGZvciAobj0wOyBuIDwgc2VsOyBuKyspIHtcbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gbjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yIHR5cGUgJ1wiICsgdGhpcy5fYXR0cnMuZm9ybW9kZSArIFwiJyBpbiBcIiAuIHRoaXMub3V0ZXJIVE1MO1xuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSBuOyBzZWwubGVuZ3RoIDwgdGhpcy5fZWxzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGxldCBlbGVtID0gdGhpcy5fZWxzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ck5vZGUuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgICAgIGN1ck5vZGUuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1sb29wXCIsIEthTG9vcCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsInZhciBLQVNFTEYgPSBudWxsO1xuXG5jbGFzcyBLYVRwbCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbCxcbiAgICAgICAgICAgIFwibm9kZWJvdW5jZVwiOiBmYWxzZVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFN3aXRjaGVkIHRvIHRvIGR1cmluZyBfaW5pdCgpIHRvIGFsbG93IDxzY3JpcHQ+IHRvIHNldCBzY29wZSB3aXRob3V0IHJlbmRlcmluZy5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcblxuICAgICAgICAvLyBTdG9yZSByZWYvb24vZm4gb3V0c2lkZSB0byBhbGxvdyBzZXR0aW5nICRzY29wZSB3aXRob3V0IG92ZXJ3cml0aW5nIHRoZW1cbiAgICAgICAgdGhpcy5fcmVmcyA9IHt9O1xuICAgICAgICB0aGlzLl9vbiA9IHt9O1xuICAgICAgICB0aGlzLl9mbiA9IHt9O1xuICAgICAgICB0aGlzLl9zY29wZSA9IHtcIiRyZWZcIjp0aGlzLl9yZWZzLCBcIiRvblwiOiB0aGlzLl9vbiwgXCIkZm5cIjogdGhpcy5fZm59O1xuXG4gICAgICAgIHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9oYW5kbGVyID0ge307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVmZXIgdG8gdGhlIGN1cnJlbnQgdGVtcGxhdGUgKHNob3VsZCBiZSB1c2VkIGJ5IDxzY3JpcHQ+IGluc2lkZSBhIHRlbXBsYXRlIHRvIHJlZmVyZW5jZSB0aGVcbiAgICAgKiBjdXJyZW50IHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiBAdHlwZSB7S2FUcGx9XG4gICAgICovXG4gICAgc3RhdGljIGdldCBzZWxmKCkge1xuICAgICAgICByZXR1cm4gS2FUcGwucHJvdG90eXBlLnNlbGY7XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fcnVuVHJpZ2dlckZ1bmN0aW9uKHRoaXMuJG9uLm9uQmVmb3JlRGlzY29ubmVjdCk7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHRoaXMuX2xvZyhcImNvbm5lY3RlZENhbGxiYWNrKClcIiwgdGhpcyk7XG4gICAgICAgIGxldCBhdXRvID0gdGhpcy5nZXRBdHRyaWJ1dGUoXCJhdXRvXCIpXG4gICAgICAgIGlmIChhdXRvICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coXCJhdXRvc3RhcnQ6IF9pbml0KClcIiwgXCJkb2N1bWVudC5yZWFkeVN0YXRlOiBcIiwgZG9jdW1lbnQucmVhZHlTdGF0ZSk7XG5cbiAgICAgICAgICAgIGxldCBpbml0ID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgICAgICAgICBpZiAoYXV0byA9PT0gXCJcIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy4kc2NvcGUpO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgZXZhbChhdXRvKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaW5pdCgpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluaXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc2NvcGUgYW5kIHJlbmRlciB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIGthX3RwbChcInRwbDAxXCIpLiRzY29wZSA9IHtuYW1lOiBcImJvYlwifTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWxcbiAgICAgKi9cbiAgICBzZXQgJHNjb3BlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY29wZSA9IHZhbDtcblxuICAgICAgICAvLyBTZXQgaW1tdXRhYmxlIGRhdGFcbiAgICAgICAgdGhpcy5fc2NvcGUuJHJlZiA9IHRoaXMuX3JlZnM7XG4gICAgICAgIHRoaXMuX3Njb3BlLiRvbiA9IHRoaXMuX29uO1xuICAgICAgICB0aGlzLl9zY29wZS4kZm4gPSB0aGlzLl9mbjtcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIGxldCBoYW5kbGVyID0ge1xuICAgICAgICAgICAgc2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUsIHJlY2VpdmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLm5vZGVib3VuY2UgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEZWZhdWx0IGJlaGF2aW91cjogRGVib3VuY2U6IFNvIHlvdSBjYW4gZG8gbXVsdGlwbGUgJHNjb3BlIHVwZGF0ZWQgd2l0aCByZW5kaW5nIG9ubHkgb25jZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuX19kZWJvdW5jZVRpbWVvdXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fX2RlYm91bmNlVGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIFJldHVybiBkaXJlY3QgbGluayB0byBpbW11dGFibGUgZGF0YVxuICAgICAgICAgICAgICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCIkcmVmXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVmcztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIiRvblwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX29uO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiJGZuXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0YXJnZXRba2V5XSA9PT0gXCJvYmplY3RcIiAmJiB0YXJnZXRba2V5XSAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm94eSh0YXJnZXRba2V5XSwgaGFuZGxlcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldFtrZXldO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBuZXcgUHJveHkodGhpcy5fc2NvcGUsIGhhbmRsZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGUgY3VzdG9tIGZ1bmN0aW9ucyBmcm9tIG91dHNpZGUgdGhlIHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiA8ZXhhbXBsZT5cbiAgICAgKiAgICAga2FfdHBsKFwidHBsMVwiKS4kZm4uZG9Tb21ldGhpbmcoKTtcbiAgICAgKiA8L2V4YW1wbGU+XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHt7Y3VzdG9tRm46IChmdW5jdGlvbigqKTogc3RyaW5nKX18e319XG4gICAgICovXG4gICAgZ2V0ICRmbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRzY29wZS4kZm47XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlIGN1c3RvbSBmdW5jdGlvbiBvbiBldmVudFxuICAgICAqXG4gICAgICogQHJldHVybiB7e1xuICAgICAqICAgICAgb25CZWZvcmVSZW5kZXI6IChmdW5jdGlvbigkc2NvcGUpOiB2b2lkKSxcbiAgICAgKiAgICAgIG9uQWZ0ZXJSZW5kZXI6IChmdW5jdGlvbigkc2NvcGUpOiB2b2lkKSxcbiAgICAgKiAgICAgIG9uQWZ0ZXJGaXJzdFJlbmRlcjogKGZ1bmN0aW9uKCRzY29wZSk6IHZvaWQpXG4gICAgICogICAgICBvbkJlZm9yZURpc2Nvbm5lY3Q6IChmdW5jdGlvbigkc2NvcGUpOiB2b2lkKVxuICAgICAqICAgICAgfX1cbiAgICAgKi9cbiAgICBnZXQgJG9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJHNjb3BlLiRvbjtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgdGhlIHNjb3BlLiBXaWxsIHJldHVybiB0aGUgcHJveGllZCBzY29wZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBUaGUgcHJveHkga2VlcHMgdHJhY2sgYWJvdXQgY2hhbmdlcyB0byAkc2NvcGUgYW5kIHJlcmVuZGVycyB0aGVcbiAgICAgKiBkYXRhIHRoZW4uXG4gICAgICpcbiAgICAgKiBTbyB5b3UgY2FuIHVzZSB0aGUgcmV0dXJuIHZhbHVlIHdpdGhpbiB0aGUgc2NvcGUgZGVmaW5pdGlvbiBpdHNlbGYuXG4gICAgICpcbiAgICAgKiA8ZXhhbXBsZT5cbiAgICAgKiBsZXQgJHNjb3BlID0gS2FUcGwuc2VsZi5zY29wZUluaXQoe3NvbWVEYXRhOiBbXX0pO1xuICAgICAqIDwvZXhhbXBsZT5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7eyRmbjp7fSwgJG9uOnt9fX0gJHNjb3BlXG4gICAgICogQHJldHVybiB7UHJveHk8e30+fVxuICAgICAqL1xuICAgIHNjb3BlSW5pdCgkc2NvcGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiAkc2NvcGUuJGZuICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgdGhpcy5fZm4gPSAkc2NvcGUuJGZuO1xuICAgICAgICBpZiAodHlwZW9mICRzY29wZS4kb24gIT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICB0aGlzLl9vbiA9ICRzY29wZS4kb247XG5cbiAgICAgICAgdGhpcy4kc2NvcGUgPSAkc2NvcGU7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuJHNjb3BlOyAvLyA8LSBRdWVyeSBzY29wZSBvdmVyIGdldHRlciB0byByZWNlaXZlIHByb3h5XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBXYWl0IGZvciBhIHJlZmVyZW5jZSB0byBiZSByZW5kZXJlZFxuICAgICAqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBpcyByZXNvbHZlZCBvbmNlIHRoZSBSZWZlcmVuY2VkXG4gICAgICogRWxlbWVudCAoY29udGFpbmluZyAqcmVmIGF0dHJpYnV0ZSkgaW4gdGVtcGxhdGUgYW5kIGFsbCBpdHNcbiAgICAgKiBjaGlsZCBlbGVtZW50cyB3YXMgcmVuZGVyZWQuXG4gICAgICpcbiAgICAgKiBJZiB0aGUgZWxlbWVudFxuICAgICAqXG4gICAgICogPGV4YW1wbGU+XG4gICAgICogICAgIDxzY3JpcHQ+XG4gICAgICogICAgICAgICAgKGFzeW5jKHNlbGYpID0+ICB7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGlucHV0ID0gYXdhaXQgc2VsZi53YWl0UmVmKFwiaW5wdXQxXCIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyAoaW5wdXQgKTtcbiAgICAgICAgICAgICAgICB9KShLYVRwbC5zZWxmKTtcbiAgICAgKiAgICAgPC9zY3JpcHQ+XG4gICAgICogICAgIGxldCBlbGVtID0gYXdhaXQgc2VsZi53YWl0UmVmKFwiaW5wdXQxXCIpXG4gICAgICogPC9leGFtcGxlPlxuICAgICAqXG4gICAgICogQHBhcmFtIG5hbWVcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHdhaXRSZWYobmFtZSkge1xuICAgICAgICBpZiAodHlwZW9mIHRoaXMuJHNjb3BlLiRyZWZbbmFtZV0gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHZhciByZXNvbHZlcjtcbiAgICAgICAgICAgIGxldCBwID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZXIgPSByZXNvbHZlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHAucmVzb2x2ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHJlc29sdmVyKHZhbHVlKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLiRzY29wZS4kcmVmW25hbWVdID0gcDtcbiAgICAgICAgICAgIHJldHVybiBwO1xuICAgICAgICB9XG4gICAgICAgIC8vIFJldHVybiBpbW1lZGlhdGUgaWYgcmVmZXJlbmNlIGFscmVhZHkgZXhpc3RpbmdcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLiRzY29wZS4kcmVmW25hbWVdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBWZXJpZnkgaWYgdGhpcyBpcyB0aGUgZmlyc3QgcmVuZGVyIGF0dGVtcHRcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgZmlyc3QgcmVuZGVyXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW5pdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyAhPT0gbnVsbClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcgIT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBsb2FkZXIgZWxlbWVudFxuICAgICAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nLmhhc0F0dHJpYnV0ZShcImthLWxvYWRlclwiKSlcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICAobmV3IEt0VGVtcGxhdGVQYXJzZXIpLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgc2VsZiByZWZlcmVuY2UgKHNlZTogS2FUcGwuc2VsZilcbiAgICAgICAgS0FTRUxGID0gdGhpcztcbiAgICAgICAgS2FUcGwucHJvdG90eXBlLnNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgX3J1blRyaWdnZXJGdW5jdGlvbihmbikge1xuICAgICAgICBpZiAodHlwZW9mIGZuID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICBmbih0aGlzLiRzY29wZSwgdGhpcyk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBJbXBsaWNpdCByZW5kZXIgdGhlIHRlbXBsYXRlXG4gICAgICpcbiAgICAgKlxuICAgICAqXG4gICAgICogQHBhcmFtICRzY29wZSB7e318bnVsbH1cbiAgICAgKi9cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgJHNjb3BlID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgJHNjb3BlID0gdGhpcy4kc2NvcGU7XG4gICAgICAgIHRoaXMuX2xvZyhcInJlbmRlcigkc2NvcGU9IFwiLCAkc2NvcGUsIFwiKVwiKTtcbiAgICAgICAgbGV0IGlzRmlyc3RSZW5kZXIgPSB0aGlzLl9pbml0KCk7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gdHJ1ZTtcblxuICAgICAgICAvLyBJbXBvcnRhbnQ6IHJ1biBhZnRlciBfaXNSZW5kZXJpbmcgaXMgdHJ1ZSAtPiBza2lwIHJlY3Vyc2lvblxuICAgICAgICB0aGlzLl9ydW5UcmlnZ2VyRnVuY3Rpb24odGhpcy4kb24ub25CZWZvcmVSZW5kZXIpO1xuXG4gICAgICAgIGZvcihsZXQgY2Ugb2YgdGhpcy5fZWxzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEV4ZWN1dGUgJG9uIGNhbGxiYWNrc1xuICAgICAgICBpZiAoaXNGaXJzdFJlbmRlcikge1xuICAgICAgICAgICAgdGhpcy5fcnVuVHJpZ2dlckZ1bmN0aW9uKHRoaXMuJG9uLm9uQWZ0ZXJGaXJzdFJlbmRlcilcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9ydW5UcmlnZ2VyRnVuY3Rpb24odGhpcy4kb24ub25BZnRlclJlbmRlcik7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTtcbiIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgdiA9IEpTT04uc3RyaW5naWZ5KHYpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIHYgPSB0aGlzLl9rdEhscHIudW5pbmRlbnRUZXh0KHYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgaXNUcnVlID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCB0aGlzLl9hdHRycy5zdG10KTtcblxuICAgICAgICBpZiAoICEgaXNUcnVlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWlmXCIsIEt0SWYsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdE1haW50YWluIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG4gICAgICAgICAgICAgICAgaWYgKCAhIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHJOYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgS1RfRk5bYXR0ck5hbWVdKGN1ckVsZW1lbnQsIGN1ckVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSwgJHNjb3BlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiXX0=
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoia2FzaW1pci10cGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJcbmNsYXNzIEt0SGVscGVyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RtdFxuICAgICAqIEBwYXJhbSB7Y29udGV4dH0gX19zY29wZVxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgX19zY29wZSwgZSwgX19yZWZzKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIiwgXCJhd2FpdFwiLCBcIiR0aGlzXCJdO1xuICAgICAgICBsZXQgciA9IFwidmFyICR0aGlzID0gZTtcIjtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluIF9fc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9IF9fc2NvcGVbJyR7X19uYW1lfSddO2BcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiB0aGUgc2NvcGUgd2FzIGNsb25lZCwgdGhlIG9yaWdpbmFsIHdpbGwgYmUgaW4gJHNjb3BlLiBUaGlzIGlzIGltcG9ydGFudCB3aGVuXG4gICAgICAgIC8vIFVzaW5nIGV2ZW50cyBbb24uY2xpY2tdLCBlLmcuXG4gICAgICAgIGlmICh0eXBlb2YgX19zY29wZS4kc2NvcGUgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHIgKz0gXCJ2YXIgJHNjb3BlID0gX19zY29wZTtcIjtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGV2YWwociArIHN0bXQpXG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiY2Fubm90IGV2YWwoKSBzdG10OiAnXCIgKyBzdG10ICsgXCInOiBcIiArIGV4ICsgXCIgb24gZWxlbWVudCBcIiwgZSwgXCIoY29udGV4dDpcIiwgX19zY29wZSwgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJldmFsKCdcIiArIHN0bXQgKyBcIicpIGZhaWxlZDogXCIgKyBleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBzdHJpbmcgdG8gYmUgZXZhbCgpJ2VkIHJlZ2lzdGVyaW5nXG4gICAgICogYWxsIHRoZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gbWV0aG9kIGNvbnRleHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKi9cbiAgICBzY29wZUV2YWwoJHNjb3BlLCBzZWxlY3RvciwgZWxlbSkge1xuICAgICAgICBjb25zdCByZXNlcnZlZCA9IFtcInZhclwiLCBcIm51bGxcIiwgXCJsZXRcIiwgXCJjb25zdFwiLCBcImZ1bmN0aW9uXCIsIFwiY2xhc3NcIiwgXCJpblwiLCBcIm9mXCIsIFwiZm9yXCIsIFwidHJ1ZVwiLCBcImZhbHNlXCIsIFwiYXdhaXRcIiwgXCIkdGhpc1wiXTtcbiAgICAgICAgbGV0IHIgPSBcInZhciAkdGhpcyA9IGVsZW07XCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIHZhciBfX3ZhbCA9IG51bGw7XG4gICAgICAgIGxldCBzID0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV2YWwociArIHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBzY29wZUV2YWwoJyR7c30nKSBmYWlsZWQ6ICR7ZX0gb25gLCBlbGVtKTtcbiAgICAgICAgICAgIHRocm93IGBldmFsKCcke3N9JykgZmFpbGVkOiAke2V9YDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX192YWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogIEZpbmQgdGhlIGZpcnN0IHdoaXRlc3BhY2VzIGluIHRleHQgYW5kIHJlbW92ZSB0aGVtIGZyb20gdGhlXG4gICAgICogIHN0YXJ0IG9mIHRoZSBmb2xsb3dpbmcgbGluZXMuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtzdHJpbmd9IHN0clxuICAgICAqICBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICovXG4gICAgdW5pbmRlbnRUZXh0KHN0cikge1xuICAgICAgICBsZXQgaSA9IHN0ci5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZShuZXcgUmVnRXhwKGBcXG4ke2l9YCwgXCJnXCIpLCBcIlxcblwiKTtcbiAgICAgICAgc3RyID0gc3RyLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG59IiwiXG52YXIgX0tUX0VMRU1FTlRfSUQgPSAwO1xuXG5jbGFzcyBLdFJlbmRlcmFibGUgZXh0ZW5kcyBIVE1MVGVtcGxhdGVFbGVtZW50IHtcblxuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faGxwciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSB3aXRoIGFsbCBvYnNlcnZlZCBlbGVtZW50cyBvZiB0aGlzIHRlbXBsYXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIG51bGwgaW5kaWNhdGVzLCB0aGUgdGVtcGxhdGUgd2FzIG5vdCB5ZXQgcmVuZGVyZWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0hUTUxFbGVtZW50W119XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VscyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1wiZGVidWdcIjogZmFsc2V9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgaW50ZXJuYWwgZWxlbWVudCBpZCB0byBpZGVudGlmeSB3aGljaCBlbGVtZW50c1xuICAgICAgICAgKiB0byByZW5kZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SWQgPSArK19LVF9FTEVNRU5UX0lEO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5fYXR0cnNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIF9sb2codjEsIHYyLCB2Mykge1xuICAgICAgICBsZXQgYSA9IFsgdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIjXCIgKyB0aGlzLmlkICsgXCJbXCIgKyB0aGlzLl9rdElkICsgXCJdOlwiXTtcblxuICAgICAgICBmb3IgKGxldCBlIG9mIGFyZ3VtZW50cylcbiAgICAgICAgICAgIGEucHVzaChlKTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZGVidWcgIT09IGZhbHNlKVxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBXYWxrIHRocm91Z2ggYWxsIGVsZW1lbnRzIGFuZCB0cnkgdG8gcmVuZGVyIHRoZW0uXG4gICAgICpcbiAgICAgKiBpZiBhIGVsZW1lbnQgaGFzIHRoZSBfa2FNYiAobWFpbnRhaW5lZCBieSkgcHJvcGVydHkgc2V0LFxuICAgICAqIGNoZWNrIGlmIGl0IGVxdWFscyB0aGlzLl9rYUlkICh0aGUgZWxlbWVudCBpZCkuIElmIG5vdCxcbiAgICAgKiBza2lwIHRoaXMgbm9kZS5cbiAgICAgKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKi9cbiAgICByZW5kZXJSZWN1cnNpdmUobm9kZSwgJHNjb3BlKSB7XG4gICAgICAgIGlmIChub2RlLmhhc093blByb3BlcnR5KFwiX2thTWJcIikgJiYgbm9kZS5fa2FNYiAhPT0gdGhpcy5fa3RJZClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBsZXQgcmVmUHJvbWlzZSA9IG51bGw7XG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgcmVmZXJlbmNlc1xuICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmIG5vZGUuaGFzQXR0cmlidXRlKFwiKnJlZlwiKSkge1xuICAgICAgICAgICAgbGV0IHJlZm5hbWUgPSBub2RlLmdldEF0dHJpYnV0ZShcIipyZWZcIik7XG4gICAgICAgICAgICByZWZQcm9taXNlID0gJHNjb3BlLiRyZWZbcmVmbmFtZV07XG4gICAgICAgICAgICAkc2NvcGUuJHJlZltyZWZuYW1lXSA9IG5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWdpc3RlciBpZCBvZiBjbG9uZWQgbm9kZVxuICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmIG5vZGUuaGFzQXR0cmlidXRlKFwiKmlkXCIpKSB7XG4gICAgICAgICAgICBub2RlLmlkID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqaWRcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG5vZGUucmVuZGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyKCRzY29wZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5rdFNraXBSZW5kZXIgPT09IHRydWUpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZWZQcm9taXNlICE9PSBudWxsICYmIHR5cGVvZiByZWZQcm9taXNlICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiByZWZQcm9taXNlLnJlc29sdmUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgLy8gUmVzb2x2ZSBwcm9taXNlIHJlZ2lzdGVyZWQgd2l0aCB3YWl0UmVmKClcbiAgICAgICAgICAgIHJlZlByb21pc2UucmVzb2x2ZShub2RlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW1vdmVOb2RlcygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGVsLl9yZW1vdmVOb2RlcyA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgIGVsLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgaWYgKHRoaXMucGFyZW50RWxlbWVudCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VscyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvbmUgYW5kIGFwcGVuZCBhbGwgZWxlbWVudHMgaW5cbiAgICAgKiBjb250ZW50IG9mIHRlbXBsYXRlIHRvIHRoZSBuZXh0IHNpYmxpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gc2libGluZ1xuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKi9cbiAgICBfYXBwZW5kRWxlbWVudHNUb1BhcmVudChzaWJsaW5nKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2libGluZyA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgIHNpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG4gICAgICAgIGxldCBjbiA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBjZWwgb2YgY24uY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGNlbC5fa2FNYiA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICB0aGlzLl9lbHMucHVzaChjZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShjbiwgc2libGluZyk7XG5cbiAgICB9XG5cbn1cblxuXG5cbiIsIlxuXG5jbGFzcyBLdFRlbXBsYXRlUGFyc2VyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdGV4dFxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ21lbnRcbiAgICAgKiBAcmV0dXJuIHtudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlVGV4dE5vZGUgKHRleHQsIGZyYWdtZW50KSB7XG4gICAgICAgIGxldCBzcGxpdCA9IHRleHQuc3BsaXQoLyhcXHtcXHt8XFx9XFx9KS8pO1xuICAgICAgICB3aGlsZShzcGxpdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChuZXcgVGV4dChzcGxpdC5zaGlmdCgpKSk7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgbGV0IHZhbCA9IG5ldyBLYVZhbCgpO1xuICAgICAgICAgICAgdmFsLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgc3BsaXQuc2hpZnQoKS50cmltKCkpO1xuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHZhbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcbiAgICAgKi9cbiAgICBwYXJzZVJlY3Vyc2l2ZShub2RlKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJba2EtdHBsXSBwYXJzZVJlY3Vyc2l2ZShcIiwgbm9kZSwgXCIpXCIpO1xuICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIERvY3VtZW50RnJhZ21lbnQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IG4gb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKG4pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUudGFnTmFtZSA9PT0gXCJTQ1JJUFRcIilcbiAgICAgICAgICAgIHJldHVybjsgLy8gRG9uJ3QgcGFyc2UgYmV3ZWVuIDxzY3JpcHQ+PC9zY3JpcHQ+IHRhZ3NcblxuICAgICAgICBpZiAodHlwZW9mIG5vZGUuZ2V0QXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKG5vZGUua3RQYXJzZWQgPT09IHRydWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbm9kZS5rdFBhcnNlZCA9IHRydWU7XG5cbiAgICAgICAgZm9yIChsZXQgdGV4dE5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRleHROb2RlLmRhdGEgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBsZXQgZnJhZ21lbnQgPSBuZXcgRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VUZXh0Tm9kZSh0ZXh0Tm9kZS5kYXRhLCBmcmFnbWVudCk7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5yZXBsYWNlV2l0aChmcmFnbWVudCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrYS1sb29wXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqZm9yXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG5cbiAgICAgICAgICAgIGxldCBtYSA9IGF0dHIubWF0Y2goL2xldFxccysoXFxTKilcXHMrKGlufG9mfHJlcGVhdClcXHMrKFxcUyopKFxccytpbmRleGJ5XFxzKyhcXFMqKSk/Lyk7XG4gICAgICAgICAgICBpZiAobWEgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcm1vZGVcIiwgbWFbMl0pO1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yc2VsZWN0XCIsIG1hWzNdKTtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmRhdGFcIiwgbWFbMV0pO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbWFbNV0gIT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yaWR4XCIsIG1hWzVdKTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yZXZhbFwiKSkge1xuICAgICAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmV2YWxcIiwgbm9kZS5nZXRBdHRyaWJ1dGUoXCIqZm9yZXZhbFwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkNhbm5vdCBwYXJzZSAqZm9yPSdcIiArIGF0dHIgKyBcIicgZm9yIGVsZW1lbnQgXCIgKyBub2RlLm91dGVySFRNTDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBydW5zIGFmdGVyICpmb3IgKHRvIGZpbHRlciBmb3IgdmFsdWVzKVxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqaWZcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1pZlwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmlmXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgYXR0cik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjc3NDbGFzc2VzID0gW107XG4gICAgICAgIGxldCBrdENsYXNzZXMgPSBudWxsO1xuICAgICAgICBsZXQgYXR0cnMgPSBbXTtcbiAgICAgICAgbGV0IGV2ZW50cyA9IHt9O1xuICAgICAgICBsZXQgc3R5bGVzID0gW107XG5cbiAgICAgICAgbGV0IHJlZ2V4ID0gbmV3IFJlZ0V4cChcIl5cXFxcWyguKylcXFxcXSRcIik7XG4gICAgICAgIGZvcihsZXQgYXR0ck5hbWUgb2Ygbm9kZS5nZXRBdHRyaWJ1dGVOYW1lcygpKSB7XG5cbiAgICAgICAgICAgIGxldCByZXN1bHQgPSByZWdleC5leGVjKGF0dHJOYW1lKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGxldCBzcGxpdCA9IHJlc3VsdFsxXS5zcGxpdChcIi5cIik7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgYXR0cnMucHVzaChgJyR7c3BsaXRbMF19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoc3BsaXRbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImNsYXNzbGlzdFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNwbGl0WzFdID09PSBcIlwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga3RDbGFzc2VzID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjc3NDbGFzc2VzLnB1c2goYCcke3NwbGl0WzFdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm9uXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudHNbc3BsaXRbMV1dID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcInN0eWxlXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiSW52YWxpZCBhdHRyaWJ1dGUgJ1wiICsgYXR0ck5hbWUgKyBcIidcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMCB8fCBjc3NDbGFzc2VzLmxlbmd0aCA+IDAgfHwga3RDbGFzc2VzICE9PSBudWxsIHx8IE9iamVjdC5rZXlzKGV2ZW50cykubGVuZ3RoID4gMCB8fCBzdHlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LW1haW50YWluXCJ9KTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuXG5cbiAgICAgICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1hdHRyc1wiLCBcIntcIiArIGF0dHJzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuXG4gICAgICAgICAgICBpZiAoc3R5bGVzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LXN0eWxlc1wiLCBcIntcIiArIHN0eWxlcy5qb2luKFwiLFwiKSArIFwifVwiKTtcblxuICAgICAgICAgICAgaWYgKGt0Q2xhc3NlcyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vIGluY2x1ZGUgW2NsYXNzbGlzdC5dPVwie2NsYXNzOiBjb25kfVwiXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWNsYXNzZXNcIiwga3RDbGFzc2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWNsYXNzZXNcIiwgXCJ7XCIgKyBjc3NDbGFzc2VzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZXZlbnRzKS5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1vblwiLCBKU09OLnN0cmluZ2lmeShldmVudHMpKTtcblxuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShjdXJOb2RlKTtcblxuXG5cbiAgICB9XG5cbn0iLCIvKipcbiAqXG4gKiBAcmV0dXJuIEthVHBsXG4gKi9cbmZ1bmN0aW9uIGthX3RwbChzZWxlY3Rvcikge1xuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEthVHBsKVxuICAgICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgbGV0IGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3Rvcik7XG4gICAgaWYgKGVsZW0gaW5zdGFuY2VvZiBLYVRwbCkge1xuICAgICAgICByZXR1cm4gZWxlbTtcbiAgICB9XG4gICAgdGhyb3cgYFNlbGVjdG9yICcke3NlbGVjdG9yfScgaXMgbm90IGEgPHRlbXBsYXRlIGlzPVwia2EtdHBsXCI+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IGNsYXNzZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCwgZWxlbSk7XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsXG4gICAgICogQHBhcmFtIHNjb3BlXG4gICAgICovXG4gICAgXCJrdC1zdHlsZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IHN0eWxlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsLCBlbGVtKTtcbiAgICAgICAgZm9yIChsZXQgc3R5bGVOYW1lIGluIHN0eWxlcykge1xuICAgICAgICAgICAgaWYgKCAhIHN0eWxlcy5oYXNPd25Qcm9wZXJ0eShzdHlsZU5hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKHN0eWxlc1tzdHlsZU5hbWVdID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zdHlsZS5yZW1vdmVQcm9wZXJ0eShzdHlsZU5hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLnN0eWxlLnNldFByb3BlcnR5KHN0eWxlTmFtZSwgc3R5bGVzW3N0eWxlTmFtZV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIFwia3QtYXR0cnNcIjogZnVuY3Rpb24gKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBjbGFzc2VzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwsIGVsZW0pO1xuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gIT09IG51bGwgJiYgY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKGNsYXNzTmFtZSwgY2xhc3Nlc1tjbGFzc05hbWVdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5yZW1vdmVBdHRyaWJ1dGUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgXCJrdC1vblwiOiBmdW5jdGlvbiAoZWxlbSwgdmFsLCAkc2NvcGUpIHtcbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLy8gQ2xvbmUgdGhlIGZpcnN0IGxheWVyIG9mIHRoZSBzY29wZSBzbyBpdCBjYW4gYmUgZXZhbHVhdGVkIG9uIGV2ZW50XG4gICAgICAgIGxldCBzYXZlU2NvcGUgPSB7Li4uJHNjb3BlfTtcbiAgICAgICAgc2F2ZVNjb3BlLiRzY29wZSA9ICRzY29wZTtcbiAgICAgICAgLy9zYXZlU2NvcGUuJHJlZiA9ICRzY29wZS4kcmVmO1xuXG4gICAgICAgIGxldCBldmVudHMgPSBKU09OLnBhcnNlKHZhbCk7XG4gICAgICAgIGZvciAobGV0IGV2ZW50IGluIGV2ZW50cykge1xuICAgICAgICAgICAgZWxlbVtcIm9uXCIgKyBldmVudF0gPSAoZSkgPT4ge1xuICAgICAgICAgICAgICAgIGt0aGVscGVyLmtldmFsKGV2ZW50c1tldmVudF0sIHNhdmVTY29wZSwgZWxlbSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9XG59OyIsIlxuXG5jbGFzcyBLYUluY2x1ZGUgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcInNyY1wiOiBudWxsLFxuICAgICAgICAgICAgXCJhdXRvXCI6IG51bGwsXG4gICAgICAgICAgICBcInJhd1wiOiBudWxsLFxuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzcmNcIiwgXCJkZWJ1Z1wiLCBcImF1dG9cIiwgXCJyYXdcIl07XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiA8c2NyaXB0PiB0YWdzIHRoYXQgd2VyZSBsb2FkZWQgdmlhIGFqYXggd29uJ3QgYmUgZXhlY3V0ZWRcbiAgICAgKiB3aGVuIGFkZGVkIHRvIGRvbS5cbiAgICAgKlxuICAgICAqIFRoZXJlZm9yZSB3ZSBoYXZlIHRvIHJld3JpdGUgdGhlbS4gVGhpcyBtZXRob2QgZG9lcyB0aGlzXG4gICAgICogYXV0b21hdGljYWxseSBib3RoIGZvciBub3JtYWwgYW5kIGZvciB0ZW1wbGF0ZSAoY29udGVudCkgbm9kZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbm9kZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2ltcG9ydFNjcml0cFJlY3Vyc2l2ZShub2RlKSB7XG4gICAgICAgIGxldCBjaGVscyA9IG5vZGUgaW5zdGFuY2VvZiBIVE1MVGVtcGxhdGVFbGVtZW50ID8gbm9kZS5jb250ZW50LmNoaWxkTm9kZXMgOiBub2RlLmNoaWxkTm9kZXM7XG5cbiAgICAgICAgZm9yIChsZXQgcyBvZiBjaGVscykge1xuICAgICAgICAgICAgaWYgKHMudGFnTmFtZSAhPT0gXCJTQ1JJUFRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltcG9ydFNjcml0cFJlY3Vyc2l2ZShzKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKTtcbiAgICAgICAgICAgIG4uaW5uZXJIVE1MID0gcy5pbm5lckhUTUw7XG4gICAgICAgICAgICBzLnJlcGxhY2VXaXRoKG4pO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICBfbG9hZERhdGFSZW1vdGUoKSB7XG4gICAgICAgIGxldCB4aHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIHhodHRwLm9wZW4oXCJHRVRcIiwgdGhpcy5fYXR0cnMuc3JjKTtcbiAgICAgICAgeGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHhodHRwLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGh0dHAuc3RhdHVzID49IDQwMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJDYW4ndCBsb2FkICdcIiArIHRoaXMucGFyYW1zLnNyYyArIFwiJzogXCIgKyB4aHR0cC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0geGh0dHAucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hdHRycy5yYXcgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHAgPSBuZXcgS3RUZW1wbGF0ZVBhcnNlcigpO1xuICAgICAgICAgICAgICAgICAgICBwLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gTm9kZXMgbG9hZGVkIGZyb20gcmVtb3RlIHdvbid0IGdldCBleGVjdXRlZC4gU28gaW1wb3J0IHRoZW0uXG4gICAgICAgICAgICAgICAgdGhpcy5faW1wb3J0U2NyaXRwUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvZyhcInRyaWdnZXIgRE9NQ29udGVudExvYWRlZCBldmVudCBvblwiLCBlbCk7XG4gICAgICAgICAgICAgICAgICAgIGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KFwiRE9NQ29udGVudExvYWRlZFwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuXG4gICAgICAgIHhodHRwLnNlbmQoKTtcbiAgICB9XG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgbGV0IGF1dG8gPSB0aGlzLmdldEF0dHJpYnV0ZShcImF1dG9cIik7XG4gICAgICAgIGlmIChhdXRvICE9PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvYWREYXRhUmVtb3RlKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2xvYWREYXRhUmVtb3RlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuXG5cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLWluY2x1ZGVcIiwgS2FJbmNsdWRlLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS2FMb29wIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX29yaWdTaWJsaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJmb3JzZWxlY3RcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9ybW9kZVwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JpZHhcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yZGF0YVwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JldmFsXCI6IG51bGxcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcImZvcnNlbGVjdFwiLCBcImZvcmlkeFwiLCBcImZvcmRhdGFcIiwgXCJmb3JldmFsXCIsIFwiZm9ybW9kZVwiXTtcbiAgICB9XG5cblxuICAgIF9hcHBlbmRFbGVtKCkge1xuICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIGxldCBub2RlcyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGN1ck5vZGUuX2thTWIgPSB0aGlzLl9rdElkO1xuICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShub2Rlc1tpXSwgdGhpcy5fb3JpZ1NpYmxpbmcpO1xuICAgICAgICB0aGlzLl9lbHMucHVzaCh7XG4gICAgICAgICAgICBub2RlOiBub2Rlc1xuICAgICAgICB9KTtcbiAgICB9XG5cblxuICAgIF9tYWludGFpbk5vZGUoaSwgJHNjb3BlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMubGVuZ3RoIDwgaSsxKVxuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbSgpO1xuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZm9yaWR4ICE9PSBudWxsKVxuICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmlkeF0gPSBpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3JldmFsICE9PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5faGxwci5rZXZhbCh0aGlzLl9hdHRycy5mb3JldmFsLCAkc2NvcGUsIHRoaXMpO1xuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzW2ldLm5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgbGV0IF9hX3NlbCA9IHRoaXMuX2F0dHJzLmZvcnNlbGVjdDtcbiAgICAgICAgbGV0IHNlbCA9IHRoaXMuX2hscHIuc2NvcGVFdmFsKCRzY29wZSwgX2Ffc2VsLCB0aGlzKTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZm9ybW9kZSAhPT0gXCJyZXBlYXRcIikge1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHNlbCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgSW52YWxpZCBmb3JTZWxlY3Q9XCIke19hX3NlbH1cIiByZXR1cm5lZDpgLCBzZWwsIFwib24gY29udGV4dFwiLCBjb250ZXh0LCBcIihFbGVtZW50OiBcIiwgdGhpcywgXCIpXCIpO1xuICAgICAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCBmb3JTZWxlY3Qgc2VsZWN0b3IuIHNlZSB3YXJpbmcuXCJcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNlbCA9PT0gbnVsbCB8fCAodHlwZW9mIHNlbFtTeW1ib2wuaXRlcmF0b3JdICE9PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIHNlbCAhPT0gJ29iamVjdCcpICkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2xvZyhgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIG5vdCBpdGVyYWJsZS4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc2VsICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9nKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIGEgbnVtYmVyLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBhIG51bWJlci4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLl9vcmlnU2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cblxuICAgICAgICBsZXQgbiA9IDA7XG4gICAgICAgIHN3aXRjaCAodGhpcy5fYXR0cnMuZm9ybW9kZSkge1xuICAgICAgICAgICAgY2FzZSBcImluXCI6XG4gICAgICAgICAgICAgICAgbiA9IDA7XG4gICAgICAgICAgICAgICAgZm9yKGxldCBpIGluIHNlbCkge1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgbisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcIm9mXCI6XG4gICAgICAgICAgICAgICAgbiA9IDA7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSBvZiBzZWwpIHtcblxuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgbisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcInJlcGVhdFwiOlxuICAgICAgICAgICAgICAgIGZvciAobj0wOyBuIDwgc2VsOyBuKyspIHtcbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gbjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yIHR5cGUgJ1wiICsgdGhpcy5fYXR0cnMuZm9ybW9kZSArIFwiJyBpbiBcIiAuIHRoaXMub3V0ZXJIVE1MO1xuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSBuOyBzZWwubGVuZ3RoIDwgdGhpcy5fZWxzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGxldCBlbGVtID0gdGhpcy5fZWxzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ck5vZGUuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgICAgIGN1ck5vZGUuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1sb29wXCIsIEthTG9vcCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsInZhciBLQVNFTEYgPSBudWxsO1xuXG5jbGFzcyBLYVRwbCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbCxcbiAgICAgICAgICAgIFwibm9kZWJvdW5jZVwiOiBmYWxzZVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFN3aXRjaGVkIHRvIHRvIGR1cmluZyBfaW5pdCgpIHRvIGFsbG93IDxzY3JpcHQ+IHRvIHNldCBzY29wZSB3aXRob3V0IHJlbmRlcmluZy5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcblxuICAgICAgICAvLyBTdG9yZSByZWYvb24vZm4gb3V0c2lkZSB0byBhbGxvdyBzZXR0aW5nICRzY29wZSB3aXRob3V0IG92ZXJ3cml0aW5nIHRoZW1cbiAgICAgICAgdGhpcy5fcmVmcyA9IHt9O1xuICAgICAgICB0aGlzLl9vbiA9IHt9O1xuICAgICAgICB0aGlzLl9mbiA9IHt9O1xuICAgICAgICB0aGlzLl9zY29wZSA9IHtcIiRyZWZcIjp0aGlzLl9yZWZzLCBcIiRvblwiOiB0aGlzLl9vbiwgXCIkZm5cIjogdGhpcy5fZm59O1xuXG4gICAgICAgIHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9oYW5kbGVyID0ge307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVmZXIgdG8gdGhlIGN1cnJlbnQgdGVtcGxhdGUgKHNob3VsZCBiZSB1c2VkIGJ5IDxzY3JpcHQ+IGluc2lkZSBhIHRlbXBsYXRlIHRvIHJlZmVyZW5jZSB0aGVcbiAgICAgKiBjdXJyZW50IHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiBAdHlwZSB7S2FUcGx9XG4gICAgICovXG4gICAgc3RhdGljIGdldCBzZWxmKCkge1xuICAgICAgICByZXR1cm4gS2FUcGwucHJvdG90eXBlLnNlbGY7XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fcnVuVHJpZ2dlckZ1bmN0aW9uKHRoaXMuJG9uLm9uQmVmb3JlRGlzY29ubmVjdCk7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHRoaXMuX2xvZyhcImNvbm5lY3RlZENhbGxiYWNrKClcIiwgdGhpcyk7XG4gICAgICAgIGxldCBhdXRvID0gdGhpcy5nZXRBdHRyaWJ1dGUoXCJhdXRvXCIpXG4gICAgICAgIGlmIChhdXRvICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coXCJhdXRvc3RhcnQ6IF9pbml0KClcIiwgXCJkb2N1bWVudC5yZWFkeVN0YXRlOiBcIiwgZG9jdW1lbnQucmVhZHlTdGF0ZSk7XG5cbiAgICAgICAgICAgIGxldCBpbml0ID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgICAgICAgICBpZiAoYXV0byA9PT0gXCJcIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy4kc2NvcGUpO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgZXZhbChhdXRvKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaW5pdCgpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluaXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc2NvcGUgYW5kIHJlbmRlciB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIGthX3RwbChcInRwbDAxXCIpLiRzY29wZSA9IHtuYW1lOiBcImJvYlwifTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWxcbiAgICAgKi9cbiAgICBzZXQgJHNjb3BlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY29wZSA9IHZhbDtcblxuICAgICAgICAvLyBTZXQgaW1tdXRhYmxlIGRhdGFcbiAgICAgICAgdGhpcy5fc2NvcGUuJHJlZiA9IHRoaXMuX3JlZnM7XG4gICAgICAgIHRoaXMuX3Njb3BlLiRvbiA9IHRoaXMuX29uO1xuICAgICAgICB0aGlzLl9zY29wZS4kZm4gPSB0aGlzLl9mbjtcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIGxldCBoYW5kbGVyID0ge1xuICAgICAgICAgICAgc2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUsIHJlY2VpdmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLm5vZGVib3VuY2UgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEZWZhdWx0IGJlaGF2aW91cjogRGVib3VuY2U6IFNvIHlvdSBjYW4gZG8gbXVsdGlwbGUgJHNjb3BlIHVwZGF0ZWQgd2l0aCByZW5kaW5nIG9ubHkgb25jZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuX19kZWJvdW5jZVRpbWVvdXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fX2RlYm91bmNlVGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIFJldHVybiBkaXJlY3QgbGluayB0byBpbW11dGFibGUgZGF0YVxuICAgICAgICAgICAgICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCIkcmVmXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVmcztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIiRvblwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX29uO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiJGZuXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0YXJnZXRba2V5XSA9PT0gXCJvYmplY3RcIiAmJiB0YXJnZXRba2V5XSAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm94eSh0YXJnZXRba2V5XSwgaGFuZGxlcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldFtrZXldO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBuZXcgUHJveHkodGhpcy5fc2NvcGUsIGhhbmRsZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGUgY3VzdG9tIGZ1bmN0aW9ucyBmcm9tIG91dHNpZGUgdGhlIHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiA8ZXhhbXBsZT5cbiAgICAgKiAgICAga2FfdHBsKFwidHBsMVwiKS4kZm4uZG9Tb21ldGhpbmcoKTtcbiAgICAgKiA8L2V4YW1wbGU+XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHt7Y3VzdG9tRm46IChmdW5jdGlvbigqKTogc3RyaW5nKX18e319XG4gICAgICovXG4gICAgZ2V0ICRmbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRzY29wZS4kZm47XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlIGN1c3RvbSBmdW5jdGlvbiBvbiBldmVudFxuICAgICAqXG4gICAgICogQHJldHVybiB7e1xuICAgICAqICAgICAgb25CZWZvcmVSZW5kZXI6IChmdW5jdGlvbigkc2NvcGUpOiB2b2lkKSxcbiAgICAgKiAgICAgIG9uQWZ0ZXJSZW5kZXI6IChmdW5jdGlvbigkc2NvcGUpOiB2b2lkKSxcbiAgICAgKiAgICAgIG9uQWZ0ZXJGaXJzdFJlbmRlcjogKGZ1bmN0aW9uKCRzY29wZSk6IHZvaWQpXG4gICAgICogICAgICBvbkJlZm9yZURpc2Nvbm5lY3Q6IChmdW5jdGlvbigkc2NvcGUpOiB2b2lkKVxuICAgICAqICAgICAgfX1cbiAgICAgKi9cbiAgICBnZXQgJG9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJHNjb3BlLiRvbjtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgdGhlIHNjb3BlLiBXaWxsIHJldHVybiB0aGUgcHJveGllZCBzY29wZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBUaGUgcHJveHkga2VlcHMgdHJhY2sgYWJvdXQgY2hhbmdlcyB0byAkc2NvcGUgYW5kIHJlcmVuZGVycyB0aGVcbiAgICAgKiBkYXRhIHRoZW4uXG4gICAgICpcbiAgICAgKiBTbyB5b3UgY2FuIHVzZSB0aGUgcmV0dXJuIHZhbHVlIHdpdGhpbiB0aGUgc2NvcGUgZGVmaW5pdGlvbiBpdHNlbGYuXG4gICAgICpcbiAgICAgKiA8ZXhhbXBsZT5cbiAgICAgKiBsZXQgJHNjb3BlID0gS2FUcGwuc2VsZi5zY29wZUluaXQoe3NvbWVEYXRhOiBbXX0pO1xuICAgICAqIDwvZXhhbXBsZT5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7eyRmbjp7fSwgJG9uOnt9fX0gJHNjb3BlXG4gICAgICogQHJldHVybiB7UHJveHk8e30+fVxuICAgICAqL1xuICAgIHNjb3BlSW5pdCgkc2NvcGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiAkc2NvcGUuJGZuICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgdGhpcy5fZm4gPSAkc2NvcGUuJGZuO1xuICAgICAgICBpZiAodHlwZW9mICRzY29wZS4kb24gIT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICB0aGlzLl9vbiA9ICRzY29wZS4kb247XG5cbiAgICAgICAgdGhpcy4kc2NvcGUgPSAkc2NvcGU7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuJHNjb3BlOyAvLyA8LSBRdWVyeSBzY29wZSBvdmVyIGdldHRlciB0byByZWNlaXZlIHByb3h5XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBXYWl0IGZvciBhIHJlZmVyZW5jZSB0byBiZSByZW5kZXJlZFxuICAgICAqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCBpcyByZXNvbHZlZCBvbmNlIHRoZSBSZWZlcmVuY2VkXG4gICAgICogRWxlbWVudCAoY29udGFpbmluZyAqcmVmIGF0dHJpYnV0ZSkgaW4gdGVtcGxhdGUgYW5kIGFsbCBpdHNcbiAgICAgKiBjaGlsZCBlbGVtZW50cyB3YXMgcmVuZGVyZWQuXG4gICAgICpcbiAgICAgKiBJZiB0aGUgZWxlbWVudFxuICAgICAqXG4gICAgICogPGV4YW1wbGU+XG4gICAgICogICAgIDxzY3JpcHQ+XG4gICAgICogICAgICAgICAgKGFzeW5jKHNlbGYpID0+ICB7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGlucHV0ID0gYXdhaXQgc2VsZi53YWl0UmVmKFwiaW5wdXQxXCIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyAoaW5wdXQgKTtcbiAgICAgICAgICAgICAgICB9KShLYVRwbC5zZWxmKTtcbiAgICAgKiAgICAgPC9zY3JpcHQ+XG4gICAgICogICAgIGxldCBlbGVtID0gYXdhaXQgc2VsZi53YWl0UmVmKFwiaW5wdXQxXCIpXG4gICAgICogPC9leGFtcGxlPlxuICAgICAqXG4gICAgICogQHBhcmFtIG5hbWVcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHdhaXRSZWYobmFtZSkge1xuICAgICAgICBpZiAodHlwZW9mIHRoaXMuJHNjb3BlLiRyZWZbbmFtZV0gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHZhciByZXNvbHZlcjtcbiAgICAgICAgICAgIGxldCBwID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZXIgPSByZXNvbHZlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHAucmVzb2x2ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHJlc29sdmVyKHZhbHVlKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLiRzY29wZS4kcmVmW25hbWVdID0gcDtcbiAgICAgICAgICAgIHJldHVybiBwO1xuICAgICAgICB9XG4gICAgICAgIC8vIFJldHVybiBpbW1lZGlhdGUgaWYgcmVmZXJlbmNlIGFscmVhZHkgZXhpc3RpbmdcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLiRzY29wZS4kcmVmW25hbWVdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBWZXJpZnkgaWYgdGhpcyBpcyB0aGUgZmlyc3QgcmVuZGVyIGF0dGVtcHRcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgZmlyc3QgcmVuZGVyXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW5pdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyAhPT0gbnVsbClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcgIT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBsb2FkZXIgZWxlbWVudFxuICAgICAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nLmhhc0F0dHJpYnV0ZShcImthLWxvYWRlclwiKSlcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICAobmV3IEt0VGVtcGxhdGVQYXJzZXIpLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgc2VsZiByZWZlcmVuY2UgKHNlZTogS2FUcGwuc2VsZilcbiAgICAgICAgS0FTRUxGID0gdGhpcztcbiAgICAgICAgS2FUcGwucHJvdG90eXBlLnNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgX3J1blRyaWdnZXJGdW5jdGlvbihmbikge1xuICAgICAgICBpZiAodHlwZW9mIGZuID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICBmbih0aGlzLiRzY29wZSwgdGhpcyk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBJbXBsaWNpdCByZW5kZXIgdGhlIHRlbXBsYXRlXG4gICAgICpcbiAgICAgKlxuICAgICAqXG4gICAgICogQHBhcmFtICRzY29wZSB7e318bnVsbH1cbiAgICAgKi9cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgJHNjb3BlID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgJHNjb3BlID0gdGhpcy4kc2NvcGU7XG4gICAgICAgIHRoaXMuX2xvZyhcInJlbmRlcigkc2NvcGU9IFwiLCAkc2NvcGUsIFwiKVwiKTtcbiAgICAgICAgbGV0IGlzRmlyc3RSZW5kZXIgPSB0aGlzLl9pbml0KCk7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gdHJ1ZTtcblxuICAgICAgICAvLyBJbXBvcnRhbnQ6IHJ1biBhZnRlciBfaXNSZW5kZXJpbmcgaXMgdHJ1ZSAtPiBza2lwIHJlY3Vyc2lvblxuICAgICAgICB0aGlzLl9ydW5UcmlnZ2VyRnVuY3Rpb24odGhpcy4kb24ub25CZWZvcmVSZW5kZXIpO1xuXG4gICAgICAgIGZvcihsZXQgY2Ugb2YgdGhpcy5fZWxzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEV4ZWN1dGUgJG9uIGNhbGxiYWNrc1xuICAgICAgICBpZiAoaXNGaXJzdFJlbmRlcikge1xuICAgICAgICAgICAgdGhpcy5fcnVuVHJpZ2dlckZ1bmN0aW9uKHRoaXMuJG9uLm9uQWZ0ZXJGaXJzdFJlbmRlcilcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9ydW5UcmlnZ2VyRnVuY3Rpb24odGhpcy4kb24ub25BZnRlclJlbmRlcik7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTtcbiIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgdiA9IEpTT04uc3RyaW5naWZ5KHYpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIHYgPSB0aGlzLl9rdEhscHIudW5pbmRlbnRUZXh0KHYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgaXNUcnVlID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCB0aGlzLl9hdHRycy5zdG10KTtcblxuICAgICAgICBpZiAoICEgaXNUcnVlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWlmXCIsIEt0SWYsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdE1haW50YWluIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG4gICAgICAgICAgICAgICAgaWYgKCAhIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHJOYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgS1RfRk5bYXR0ck5hbWVdKGN1ckVsZW1lbnQsIGN1ckVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSwgJHNjb3BlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiXX0=