/**
 * Infracamp's Kasimir Templates
 *
 * A no-dependency render on request
 *
 * @author Matthias Leuffen <m@tth.es>
 */

class KtRenderable extends HTMLTemplateElement {

    /**
     *
     * @param {HTMLElement} node
     * @param {object} context
     */
    renderRecursive(node, context, ownerNodes) {
        if (typeof node.render === "function") {
            node.render(context);
            return;
        }
        if (node.hasOwnProperty("ktOwner") && ownerNodes !== true)
            return;

        for(let curNode of node.childNodes) {
            if (node.ktSkipRender === true)
                return;
            this.renderRecursive(curNode, context);
        }

    }

}




/**
 *
 * @return KtTpl
 */
function kt_tpl(selector) {
    if (selector instanceof KtTpl)
        return selector;
    let elem = document.getElementById(selector);
    if (elem instanceof KtTpl) {
        let r = new KtTemplateParser;
        r.parseRecursive(elem);
        return elem;
    }
    throw `Selector '${selector}' is not a <kt-tpl> element`;
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
        let $ = scope;
        try {
            var classes = null;
            let e = "classes = " + val;
            let ret = eval(e);
            // console.log("eval", e, "ret: ", ret, "classes:", classes);
        } catch (e) {
            throw e + " in [data] of " + elem.outerHTML;
        }
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

    "kt-attrs": function (elem, val, scope) {
        let $ = scope;
        try {
            var classes = null;
            let e = "classes = " + val;
            let ret = eval(e);
            // console.log("eval", e, "ret: ", ret, "classes:", classes);
        } catch (e) {
            throw e + " in *attrs of " + elem.outerHTML;
        }
        for (let className in classes) {
            if ( ! classes.hasOwnProperty(className))
                continue;
            if (classes[className] !== null) {
                elem.setAttribute(className, classes[className]);
            } else {
                elem.setAttribute(className, "");
            }
        }
    }
};



class KtFor extends KtRenderable {


    constructor() {
        super();
        this.elements = [];
        this.params = {
            "forselect": null,
            "foridx": "idx",
            "foreval": null
        }
    }

    static get observedAttributes() {
        return ["forselect", "foridx", "foreval"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }

    render(context) {
        let select = context[this.params.forselect];
        let $ = context;
        if (typeof select !== "object") {
            console.warn(`Invalid forSelect="${this.params.forselect}" returned:`, select, "on context", context, "(Element: ", this.outerHTML, ")");
            throw "Invalid forSelect selector. see waring."
        }


        for (let idx = this.elements.length; idx < select.length; idx++ ) {
            let newNode = this.content.cloneNode(true);
            let nodes = [];
            for (let curNode of newNode.children) {
                curNode.ktOwner = "for";
                nodes.push(curNode);
            }
            for (let i = nodes.length-1; i>=0; i--)
                this.parentElement.insertBefore(nodes[i], this.nextSibling);
            this.elements.unshift({
                node: nodes
            });

        }

        for (let idx = 0; idx < select.length; idx++) {
            context[this.params.foridx] = idx;
            context["self"] = select[idx];
            if (this.params.foreval !== null)
                eval(this.params.foreval);
            for (let curNode of this.elements[idx].node) {
                this.renderRecursive(curNode, context, true);
            }
        }


        for (let idx = this.elements.length; select.length < this.elements.length; idx++) {
            let elem = this.elements.pop();
            for (let curNode of elem.node)
                this.parentElement.removeChild(curNode);
        }
    }
}

customElements.define("kt-for", KtFor, {extends: "template"});



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


class KtInclude extends KtRenderable {


    constructor() {
        super();
        this.elements = null;
        this.params = {
            "src": null
        }
    }

    static get observedAttributes() {
        return ["src"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }


    loadRemote () {

    }


    _appendChildFromContent() {
        if (this.elements !== null)
            return;
        let newNode = this.content.cloneNode(true);
        this.elements = [];
        for (let curNode of newNode.childNodes) {
            curNode.ktOwner = "include";
            this.elements.push(curNode);
        }
        for (let i = this.elements.length-1; i>=0; i--) {
            this.parentElement.insertBefore(this.elements[i], this.nextSibling);
        }
    }

    _renderElements() {
        for (let curNode of this.elements)
            this.renderRecursive(curNode, context, true);
    }

    loadDataRemote() {
        let xhttp = new XMLHttpRequest();

        xhttp.open("GET", this.params.src);
        xhttp.onreadystatechange = () => {
            if (xhttp.readyState === 4) {
                if (xhttp.status >= 400) {
                    console.warn("Can't load '" + this.params.src + "': " + xhttp.responseText);
                    return;
                }
                this.innerHTML = xhttp.responseText;
                let p = new KtTemplateParser();
                p.parseRecursive(this.content);
                this._appendChildFromContent();
                this._renderElements();
                return;
            }

        };

        xhttp.send();
    }


    render(context) {
        if (this.elements === null)
            this.loadDataRemote();
        else
            this._renderElements();

    }
}

customElements.define("kt-include", KtInclude, {extends: "template"});



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

        if (this.elements === null) {
            let newNode = this.content.cloneNode(true);
            this.elements = [];
            for (let curNode of newNode.childNodes) {
                curNode.ktOwner = "maintain";
                this.elements.push(curNode);
            }
            for (let i = this.elements.length-1; i>=0; i--) {
                this.parentElement.insertBefore(this.elements[i], this.nextSibling);
            }
        }

        for (let curElement of this.elements) {
            if ( typeof curElement.hasAttribute !== "function")
                continue;
            for (let attrName in KT_FN) {

                if ( ! curElement.hasAttribute(attrName))
                    continue;
                KT_FN[attrName](curElement, curElement.getAttribute(attrName), context);
            }
            this.renderRecursive(curElement, context, true);
        }
    }
}

customElements.define("kt-maintain", KtMaintain, {extends: "template"});
class KtTpl extends HTMLElement {


    constructor() {
        super();
        this.elements = [];
        this.params = {
            "stmt": null
        }
        this.scope = {};
    }
    /**
     *
     * @param {HTMLElement} node
     * @param {object} context
     */
    renderRecursive(node, context) {
        if (typeof node.render === "function") {
            node.render(context);
            return;
        }
        if (node.hasOwnProperty("ktOwner"))
            return;
        for(let curNode of node.childNodes) {
            this.renderRecursive(curNode, context);
        }

    }
    static get observedAttributes() {
        return ["stmt"];
    }

    set $(val) {
        this.scope = val;
        this.renderRecursive(this.scope);
    }

    get $() {
        return this.scope;
    }


    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }

    render(context) {
        for(let curNode of this.childNodes) {
            this.renderRecursive(curNode, context);
        }
    }
}

customElements.define("kt-tpl", KtTpl);
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
        let $ = context;
        this.innerText = eval(this.params.stmt);
    }
}

customElements.define("kt-val", KtVal);


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
            let val = new KtVal();
            val.setAttribute("stmt", split.shift());
            split.shift();
            fragment.appendChild(val);
        }
    }

    /**
     *
     * @param {HTMLElement} node
     */
    parseRecursive(node) {

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
            let newNode = document.createElement("template", {is: "kt-for"});
            let attr = node.getAttribute("*for");
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true);
            newNode.content.appendChild(cloneNode);
            newNode.setAttribute("forselect", attr);
            node.replaceWith(newNode);
            node = cloneNode;
        }

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
        let attrs = [];

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
                        cssClasses.push(`'${split[1]}': ` + node.getAttribute(attrName));
                        break;
                    default:
                        console.warn("Invalid attribute '" + attrName + "'")
                }
            }
        }

        if (attrs.length > 0 || cssClasses.length > 0) {
            let newNode = document.createElement("template", {is: "kt-maintain"});
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true)
            newNode.content.appendChild(cloneNode);
            if (attrs.length > 0)
                cloneNode.setAttribute("kt-attrs", "{" + attrs.join(",") +  "}");
            if (cssClasses.length > 0)
                cloneNode.setAttribute("kt-classes", "{" + cssClasses.join(",") + "}");
            node.replaceWith(newNode);
            node = cloneNode;
        }

        for (let curNode of node.children)
            this.parseRecursive(curNode);



    }

}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtcmVuZGVyYWJsZS5qcyIsImZ1bmN0aW9ucy5qcyIsImt0LWZvci5qcyIsImt0LWlmLmpzIiwia3QtaW5jbHVkZS5qcyIsImt0LW1haW50YWluLmpzIiwia3QtdHBsLmpzIiwia3QtdmFsLmpzIiwiS3RUZW1wbGF0ZVBhcnNlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdFJlbmRlcmFibGUgZXh0ZW5kcyBIVE1MVGVtcGxhdGVFbGVtZW50IHtcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBjb250ZXh0XG4gICAgICovXG4gICAgcmVuZGVyUmVjdXJzaXZlKG5vZGUsIGNvbnRleHQsIG93bmVyTm9kZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcihjb250ZXh0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5oYXNPd25Qcm9wZXJ0eShcImt0T3duZXJcIikgJiYgb3duZXJOb2RlcyAhPT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBmb3IobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5rdFNraXBSZW5kZXIgPT09IHRydWUpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCk7XG4gICAgICAgIH1cblxuICAgIH1cblxufVxuXG5cblxuIiwiLyoqXG4gKlxuICogQHJldHVybiBLdFRwbFxuICovXG5mdW5jdGlvbiBrdF90cGwoc2VsZWN0b3IpIHtcbiAgICBpZiAoc2VsZWN0b3IgaW5zdGFuY2VvZiBLdFRwbClcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yO1xuICAgIGxldCBlbGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2VsZWN0b3IpO1xuICAgIGlmIChlbGVtIGluc3RhbmNlb2YgS3RUcGwpIHtcbiAgICAgICAgbGV0IHIgPSBuZXcgS3RUZW1wbGF0ZVBhcnNlcjtcbiAgICAgICAgci5wYXJzZVJlY3Vyc2l2ZShlbGVtKTtcbiAgICAgICAgcmV0dXJuIGVsZW07XG4gICAgfVxuICAgIHRocm93IGBTZWxlY3RvciAnJHtzZWxlY3Rvcn0nIGlzIG5vdCBhIDxrdC10cGw+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcbiAgICAgICAgbGV0ICQgPSBzY29wZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlID0gXCJjbGFzc2VzID0gXCIgKyB2YWw7XG4gICAgICAgICAgICBsZXQgcmV0ID0gZXZhbChlKTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXZhbFwiLCBlLCBcInJldDogXCIsIHJldCwgXCJjbGFzc2VzOlwiLCBjbGFzc2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgZSArIFwiIGluIFtkYXRhXSBvZiBcIiArIGVsZW0ub3V0ZXJIVE1MO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCAkID0gc2NvcGU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgY2xhc3NlcyA9IG51bGw7XG4gICAgICAgICAgICBsZXQgZSA9IFwiY2xhc3NlcyA9IFwiICsgdmFsO1xuICAgICAgICAgICAgbGV0IHJldCA9IGV2YWwoZSk7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImV2YWxcIiwgZSwgXCJyZXQ6IFwiLCByZXQsIFwiY2xhc3NlczpcIiwgY2xhc3Nlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IGUgKyBcIiBpbiAqYXR0cnMgb2YgXCIgKyBlbGVtLm91dGVySFRNTDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIGNsYXNzZXNbY2xhc3NOYW1lXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKGNsYXNzTmFtZSwgXCJcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59OyIsIlxuXG5cbmNsYXNzIEt0Rm9yIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcImZvcnNlbGVjdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JpZHhcIjogXCJpZHhcIixcbiAgICAgICAgICAgIFwiZm9yZXZhbFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcImZvcnNlbGVjdFwiLCBcImZvcmlkeFwiLCBcImZvcmV2YWxcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLnBhcmFtc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgbGV0IHNlbGVjdCA9IGNvbnRleHRbdGhpcy5wYXJhbXMuZm9yc2VsZWN0XTtcbiAgICAgICAgbGV0ICQgPSBjb250ZXh0O1xuICAgICAgICBpZiAodHlwZW9mIHNlbGVjdCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBJbnZhbGlkIGZvclNlbGVjdD1cIiR7dGhpcy5wYXJhbXMuZm9yc2VsZWN0fVwiIHJldHVybmVkOmAsIHNlbGVjdCwgXCJvbiBjb250ZXh0XCIsIGNvbnRleHQsIFwiKEVsZW1lbnQ6IFwiLCB0aGlzLm91dGVySFRNTCwgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJJbnZhbGlkIGZvclNlbGVjdCBzZWxlY3Rvci4gc2VlIHdhcmluZy5cIlxuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KysgKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiZm9yXCI7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSBub2Rlcy5sZW5ndGgtMTsgaT49MDsgaS0tKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUobm9kZXNbaV0sIHRoaXMubmV4dFNpYmxpbmcpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy51bnNoaWZ0KHtcbiAgICAgICAgICAgICAgICBub2RlOiBub2Rlc1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IHNlbGVjdC5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICAgICAgICBjb250ZXh0W3RoaXMucGFyYW1zLmZvcmlkeF0gPSBpZHg7XG4gICAgICAgICAgICBjb250ZXh0W1wic2VsZlwiXSA9IHNlbGVjdFtpZHhdO1xuICAgICAgICAgICAgaWYgKHRoaXMucGFyYW1zLmZvcmV2YWwgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLnBhcmFtcy5mb3JldmFsKTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50c1tpZHhdLm5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gdGhpcy5lbGVtZW50cy5sZW5ndGg7IHNlbGVjdC5sZW5ndGggPCB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGxldCBlbGVtID0gdGhpcy5lbGVtZW50cy5wb3AoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgZWxlbS5ub2RlKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChjdXJOb2RlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia3QtZm9yXCIsIEt0Rm9yLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RJZiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCJdO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5wYXJhbXNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGxldCBzdG10ID0gdGhpcy5wYXJhbXMuc3RtdDtcbiAgICAgICAgbGV0ICQgPSBjb250ZXh0O1xuICAgICAgICBsZXQgaXNUcnVlID0gZXZhbChzdG10KTtcblxuICAgICAgICBpZiAoaXNUcnVlKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnRzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLmVsZW1lbnRzKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJFbGVtZW50LCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiaWZcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5lbGVtZW50cy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGZvciAobGV0IG5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pZlwiLCBLdElmLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cbmNsYXNzIEt0SW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInNyY1wiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cblxuICAgIGxvYWRSZW1vdGUgKCkge1xuXG4gICAgfVxuXG5cbiAgICBfYXBwZW5kQ2hpbGRGcm9tQ29udGVudCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgY3VyTm9kZS5rdE93bmVyID0gXCJpbmNsdWRlXCI7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuZWxlbWVudHMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW5kZXJFbGVtZW50cygpIHtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgbG9hZERhdGFSZW1vdGUoKSB7XG4gICAgICAgIGxldCB4aHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIHhodHRwLm9wZW4oXCJHRVRcIiwgdGhpcy5wYXJhbXMuc3JjKTtcbiAgICAgICAgeGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHhodHRwLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGh0dHAuc3RhdHVzID49IDQwMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJDYW4ndCBsb2FkICdcIiArIHRoaXMucGFyYW1zLnNyYyArIFwiJzogXCIgKyB4aHR0cC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0geGh0dHAucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIGxldCBwID0gbmV3IEt0VGVtcGxhdGVQYXJzZXIoKTtcbiAgICAgICAgICAgICAgICBwLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwZW5kQ2hpbGRGcm9tQ29udGVudCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlckVsZW1lbnRzKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLmxvYWREYXRhUmVtb3RlKCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckVsZW1lbnRzKCk7XG5cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWluY2x1ZGVcIiwgS3RJbmNsdWRlLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RNYWludGFpbiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCJdO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5wYXJhbXNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG5cbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICAgICAgY3VyTm9kZS5rdE93bmVyID0gXCJtYWludGFpblwiO1xuICAgICAgICAgICAgICAgIHRoaXMuZWxlbWVudHMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSB0aGlzLmVsZW1lbnRzLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKHRoaXMuZWxlbWVudHNbaV0sIHRoaXMubmV4dFNpYmxpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLmVsZW1lbnRzKSB7XG4gICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXJFbGVtZW50Lmhhc0F0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgZm9yIChsZXQgYXR0ck5hbWUgaW4gS1RfRk4pIHtcblxuICAgICAgICAgICAgICAgIGlmICggISBjdXJFbGVtZW50Lmhhc0F0dHJpYnV0ZShhdHRyTmFtZSkpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIEtUX0ZOW2F0dHJOYW1lXShjdXJFbGVtZW50LCBjdXJFbGVtZW50LmdldEF0dHJpYnV0ZShhdHRyTmFtZSksIGNvbnRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyRWxlbWVudCwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJjbGFzcyBLdFRwbCBleHRlbmRzIEhUTUxFbGVtZW50IHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2NvcGUgPSB7fTtcbiAgICB9XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGNvbnRleHRcbiAgICAgKi9cbiAgICByZW5kZXJSZWN1cnNpdmUobm9kZSwgY29udGV4dCkge1xuICAgICAgICBpZiAodHlwZW9mIG5vZGUucmVuZGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyKGNvbnRleHQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmhhc093blByb3BlcnR5KFwia3RPd25lclwiKSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCk7XG4gICAgICAgIH1cblxuICAgIH1cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgc2V0ICQodmFsKSB7XG4gICAgICAgIHRoaXMuc2NvcGUgPSB2YWw7XG4gICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKHRoaXMuc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zY29wZTtcbiAgICB9XG5cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5wYXJhbXNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGZvcihsZXQgY3VyTm9kZSBvZiB0aGlzLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC10cGxcIiwgS3RUcGwpOyIsImNsYXNzIEt0VmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLnBhcmFtc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgbGV0ICQgPSBjb250ZXh0O1xuICAgICAgICB0aGlzLmlubmVyVGV4dCA9IGV2YWwodGhpcy5wYXJhbXMuc3RtdCk7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC12YWxcIiwgS3RWYWwpOyIsIlxuXG5jbGFzcyBLdFRlbXBsYXRlUGFyc2VyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdGV4dFxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ21lbnRcbiAgICAgKiBAcmV0dXJuIHtudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlVGV4dE5vZGUgKHRleHQsIGZyYWdtZW50KSB7XG4gICAgICAgIGxldCBzcGxpdCA9IHRleHQuc3BsaXQoLyhcXHtcXHt8XFx9XFx9KS8pO1xuICAgICAgICB3aGlsZShzcGxpdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChuZXcgVGV4dChzcGxpdC5zaGlmdCgpKSk7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgbGV0IHZhbCA9IG5ldyBLdFZhbCgpO1xuICAgICAgICAgICAgdmFsLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgc3BsaXQuc2hpZnQoKSk7XG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqL1xuICAgIHBhcnNlUmVjdXJzaXZlKG5vZGUpIHtcblxuICAgICAgICBpZiAodHlwZW9mIG5vZGUuZ2V0QXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKG5vZGUua3RQYXJzZWQgPT09IHRydWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbm9kZS5rdFBhcnNlZCA9IHRydWU7XG5cbiAgICAgICAgZm9yIChsZXQgdGV4dE5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRleHROb2RlLmRhdGEgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBsZXQgZnJhZ21lbnQgPSBuZXcgRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VUZXh0Tm9kZSh0ZXh0Tm9kZS5kYXRhLCBmcmFnbWVudCk7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5yZXBsYWNlV2l0aChmcmFnbWVudCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1mb3JcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yc2VsZWN0XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqaWZcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1pZlwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmlmXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgYXR0cik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjc3NDbGFzc2VzID0gW107XG4gICAgICAgIGxldCBhdHRycyA9IFtdO1xuXG4gICAgICAgIGxldCByZWdleCA9IG5ldyBSZWdFeHAoXCJeXFxcXFsoLispXFxcXF0kXCIpO1xuICAgICAgICBmb3IobGV0IGF0dHJOYW1lIG9mIG5vZGUuZ2V0QXR0cmlidXRlTmFtZXMoKSkge1xuXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcmVnZXguZXhlYyhhdHRyTmFtZSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgc3BsaXQgPSByZXN1bHRbMV0uc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goYCcke3NwbGl0WzBdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwbGl0WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJjbGFzc2xpc3RcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgYXR0cmlidXRlICdcIiArIGF0dHJOYW1lICsgXCInXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDAgfHwgY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtbWFpbnRhaW5cIn0pO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpXG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1hdHRyc1wiLCBcIntcIiArIGF0dHJzLmpvaW4oXCIsXCIpICsgIFwifVwiKTtcbiAgICAgICAgICAgIGlmIChjc3NDbGFzc2VzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWNsYXNzZXNcIiwgXCJ7XCIgKyBjc3NDbGFzc2VzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKGN1ck5vZGUpO1xuXG5cblxuICAgIH1cblxufSJdfQ==
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtcmVuZGVyYWJsZS5qcyIsImZ1bmN0aW9ucy5qcyIsImt0LWZvci5qcyIsImt0LWlmLmpzIiwia3QtaW5jbHVkZS5qcyIsImt0LW1haW50YWluLmpzIiwia3QtdHBsLmpzIiwia3QtdmFsLmpzIiwiS3RUZW1wbGF0ZVBhcnNlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdFJlbmRlcmFibGUgZXh0ZW5kcyBIVE1MVGVtcGxhdGVFbGVtZW50IHtcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBjb250ZXh0XG4gICAgICovXG4gICAgcmVuZGVyUmVjdXJzaXZlKG5vZGUsIGNvbnRleHQsIG93bmVyTm9kZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcihjb250ZXh0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5oYXNPd25Qcm9wZXJ0eShcImt0T3duZXJcIikgJiYgb3duZXJOb2RlcyAhPT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBmb3IobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5rdFNraXBSZW5kZXIgPT09IHRydWUpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCk7XG4gICAgICAgIH1cblxuICAgIH1cblxufVxuXG5cblxuIiwiLyoqXG4gKlxuICogQHJldHVybiBLdFRwbFxuICovXG5mdW5jdGlvbiBrdF90cGwoc2VsZWN0b3IpIHtcbiAgICBpZiAoc2VsZWN0b3IgaW5zdGFuY2VvZiBLdFRwbClcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yO1xuICAgIGxldCBlbGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2VsZWN0b3IpO1xuICAgIGlmIChlbGVtIGluc3RhbmNlb2YgS3RUcGwpIHtcbiAgICAgICAgbGV0IHIgPSBuZXcgS3RUZW1wbGF0ZVBhcnNlcjtcbiAgICAgICAgci5wYXJzZVJlY3Vyc2l2ZShlbGVtKTtcbiAgICAgICAgcmV0dXJuIGVsZW07XG4gICAgfVxuICAgIHRocm93IGBTZWxlY3RvciAnJHtzZWxlY3Rvcn0nIGlzIG5vdCBhIDxrdC10cGw+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcbiAgICAgICAgbGV0ICQgPSBzY29wZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlID0gXCJjbGFzc2VzID0gXCIgKyB2YWw7XG4gICAgICAgICAgICBsZXQgcmV0ID0gZXZhbChlKTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXZhbFwiLCBlLCBcInJldDogXCIsIHJldCwgXCJjbGFzc2VzOlwiLCBjbGFzc2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgZSArIFwiIGluIFtkYXRhXSBvZiBcIiArIGVsZW0ub3V0ZXJIVE1MO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCAkID0gc2NvcGU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgY2xhc3NlcyA9IG51bGw7XG4gICAgICAgICAgICBsZXQgZSA9IFwiY2xhc3NlcyA9IFwiICsgdmFsO1xuICAgICAgICAgICAgbGV0IHJldCA9IGV2YWwoZSk7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImV2YWxcIiwgZSwgXCJyZXQ6IFwiLCByZXQsIFwiY2xhc3NlczpcIiwgY2xhc3Nlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IGUgKyBcIiBpbiAqYXR0cnMgb2YgXCIgKyBlbGVtLm91dGVySFRNTDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIGNsYXNzZXNbY2xhc3NOYW1lXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKGNsYXNzTmFtZSwgXCJcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59OyIsIlxuXG5cbmNsYXNzIEt0Rm9yIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcImZvcnNlbGVjdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JpZHhcIjogXCJpZHhcIixcbiAgICAgICAgICAgIFwiZm9yZXZhbFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcImZvcnNlbGVjdFwiLCBcImZvcmlkeFwiLCBcImZvcmV2YWxcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLnBhcmFtc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgbGV0IHNlbGVjdCA9IGNvbnRleHRbdGhpcy5wYXJhbXMuZm9yc2VsZWN0XTtcbiAgICAgICAgbGV0ICQgPSBjb250ZXh0O1xuICAgICAgICBpZiAodHlwZW9mIHNlbGVjdCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBJbnZhbGlkIGZvclNlbGVjdD1cIiR7dGhpcy5wYXJhbXMuZm9yc2VsZWN0fVwiIHJldHVybmVkOmAsIHNlbGVjdCwgXCJvbiBjb250ZXh0XCIsIGNvbnRleHQsIFwiKEVsZW1lbnQ6IFwiLCB0aGlzLm91dGVySFRNTCwgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJJbnZhbGlkIGZvclNlbGVjdCBzZWxlY3Rvci4gc2VlIHdhcmluZy5cIlxuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KysgKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiZm9yXCI7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSBub2Rlcy5sZW5ndGgtMTsgaT49MDsgaS0tKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUobm9kZXNbaV0sIHRoaXMubmV4dFNpYmxpbmcpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy51bnNoaWZ0KHtcbiAgICAgICAgICAgICAgICBub2RlOiBub2Rlc1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IHNlbGVjdC5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICAgICAgICBjb250ZXh0W3RoaXMucGFyYW1zLmZvcmlkeF0gPSBpZHg7XG4gICAgICAgICAgICBjb250ZXh0W1wic2VsZlwiXSA9IHNlbGVjdFtpZHhdO1xuICAgICAgICAgICAgaWYgKHRoaXMucGFyYW1zLmZvcmV2YWwgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLnBhcmFtcy5mb3JldmFsKTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50c1tpZHhdLm5vZGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gdGhpcy5lbGVtZW50cy5sZW5ndGg7IHNlbGVjdC5sZW5ndGggPCB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGxldCBlbGVtID0gdGhpcy5lbGVtZW50cy5wb3AoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgZWxlbS5ub2RlKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChjdXJOb2RlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia3QtZm9yXCIsIEt0Rm9yLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RJZiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCJdO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5wYXJhbXNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGxldCBzdG10ID0gdGhpcy5wYXJhbXMuc3RtdDtcbiAgICAgICAgbGV0ICQgPSBjb250ZXh0O1xuICAgICAgICBsZXQgaXNUcnVlID0gZXZhbChzdG10KTtcblxuICAgICAgICBpZiAoaXNUcnVlKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnRzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLmVsZW1lbnRzKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJFbGVtZW50LCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiaWZcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5lbGVtZW50cy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGZvciAobGV0IG5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pZlwiLCBLdElmLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cbmNsYXNzIEt0SW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInNyY1wiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cblxuICAgIGxvYWRSZW1vdGUgKCkge1xuXG4gICAgfVxuXG5cbiAgICBfYXBwZW5kQ2hpbGRGcm9tQ29udGVudCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgY3VyTm9kZS5rdE93bmVyID0gXCJpbmNsdWRlXCI7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuZWxlbWVudHMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW5kZXJFbGVtZW50cygpIHtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgbG9hZERhdGFSZW1vdGUoKSB7XG4gICAgICAgIGxldCB4aHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIHhodHRwLm9wZW4oXCJHRVRcIiwgdGhpcy5wYXJhbXMuc3JjKTtcbiAgICAgICAgeGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHhodHRwLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGh0dHAuc3RhdHVzID49IDQwMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJDYW4ndCBsb2FkICdcIiArIHRoaXMucGFyYW1zLnNyYyArIFwiJzogXCIgKyB4aHR0cC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0geGh0dHAucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIGxldCBwID0gbmV3IEt0VGVtcGxhdGVQYXJzZXIoKTtcbiAgICAgICAgICAgICAgICBwLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwZW5kQ2hpbGRGcm9tQ29udGVudCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlckVsZW1lbnRzKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLmxvYWREYXRhUmVtb3RlKCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckVsZW1lbnRzKCk7XG5cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWluY2x1ZGVcIiwgS3RJbmNsdWRlLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RNYWludGFpbiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCJdO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5wYXJhbXNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG5cbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICAgICAgY3VyTm9kZS5rdE93bmVyID0gXCJtYWludGFpblwiO1xuICAgICAgICAgICAgICAgIHRoaXMuZWxlbWVudHMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSB0aGlzLmVsZW1lbnRzLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKHRoaXMuZWxlbWVudHNbaV0sIHRoaXMubmV4dFNpYmxpbmcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLmVsZW1lbnRzKSB7XG4gICAgICAgICAgICBpZiAoIHR5cGVvZiBjdXJFbGVtZW50Lmhhc0F0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgZm9yIChsZXQgYXR0ck5hbWUgaW4gS1RfRk4pIHtcblxuICAgICAgICAgICAgICAgIGlmICggISBjdXJFbGVtZW50Lmhhc0F0dHJpYnV0ZShhdHRyTmFtZSkpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIEtUX0ZOW2F0dHJOYW1lXShjdXJFbGVtZW50LCBjdXJFbGVtZW50LmdldEF0dHJpYnV0ZShhdHRyTmFtZSksIGNvbnRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyRWxlbWVudCwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJjbGFzcyBLdFRwbCBleHRlbmRzIEhUTUxFbGVtZW50IHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2NvcGUgPSB7fTtcbiAgICB9XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGNvbnRleHRcbiAgICAgKi9cbiAgICByZW5kZXJSZWN1cnNpdmUobm9kZSwgY29udGV4dCkge1xuICAgICAgICBpZiAodHlwZW9mIG5vZGUucmVuZGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyKGNvbnRleHQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmhhc093blByb3BlcnR5KFwia3RPd25lclwiKSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCk7XG4gICAgICAgIH1cblxuICAgIH1cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgc2V0ICQodmFsKSB7XG4gICAgICAgIHRoaXMuc2NvcGUgPSB2YWw7XG4gICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKHRoaXMuc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zY29wZTtcbiAgICB9XG5cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5wYXJhbXNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGZvcihsZXQgY3VyTm9kZSBvZiB0aGlzLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC10cGxcIiwgS3RUcGwpOyIsImNsYXNzIEt0VmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLnBhcmFtc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgbGV0ICQgPSBjb250ZXh0O1xuICAgICAgICB0aGlzLmlubmVyVGV4dCA9IGV2YWwodGhpcy5wYXJhbXMuc3RtdCk7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC12YWxcIiwgS3RWYWwpOyIsIlxuXG5jbGFzcyBLdFRlbXBsYXRlUGFyc2VyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdGV4dFxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ21lbnRcbiAgICAgKiBAcmV0dXJuIHtudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlVGV4dE5vZGUgKHRleHQsIGZyYWdtZW50KSB7XG4gICAgICAgIGxldCBzcGxpdCA9IHRleHQuc3BsaXQoLyhcXHtcXHt8XFx9XFx9KS8pO1xuICAgICAgICB3aGlsZShzcGxpdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChuZXcgVGV4dChzcGxpdC5zaGlmdCgpKSk7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgbGV0IHZhbCA9IG5ldyBLdFZhbCgpO1xuICAgICAgICAgICAgdmFsLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgc3BsaXQuc2hpZnQoKSk7XG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqL1xuICAgIHBhcnNlUmVjdXJzaXZlKG5vZGUpIHtcblxuICAgICAgICBpZiAodHlwZW9mIG5vZGUuZ2V0QXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKG5vZGUua3RQYXJzZWQgPT09IHRydWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbm9kZS5rdFBhcnNlZCA9IHRydWU7XG5cbiAgICAgICAgZm9yIChsZXQgdGV4dE5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRleHROb2RlLmRhdGEgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBsZXQgZnJhZ21lbnQgPSBuZXcgRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VUZXh0Tm9kZSh0ZXh0Tm9kZS5kYXRhLCBmcmFnbWVudCk7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5yZXBsYWNlV2l0aChmcmFnbWVudCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1mb3JcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yc2VsZWN0XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqaWZcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1pZlwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmlmXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgYXR0cik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjc3NDbGFzc2VzID0gW107XG4gICAgICAgIGxldCBhdHRycyA9IFtdO1xuXG4gICAgICAgIGxldCByZWdleCA9IG5ldyBSZWdFeHAoXCJeXFxcXFsoLispXFxcXF0kXCIpO1xuICAgICAgICBmb3IobGV0IGF0dHJOYW1lIG9mIG5vZGUuZ2V0QXR0cmlidXRlTmFtZXMoKSkge1xuXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcmVnZXguZXhlYyhhdHRyTmFtZSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgc3BsaXQgPSByZXN1bHRbMV0uc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goYCcke3NwbGl0WzBdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwbGl0WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJjbGFzc2xpc3RcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgYXR0cmlidXRlICdcIiArIGF0dHJOYW1lICsgXCInXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDAgfHwgY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtbWFpbnRhaW5cIn0pO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpXG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1hdHRyc1wiLCBcIntcIiArIGF0dHJzLmpvaW4oXCIsXCIpICsgIFwifVwiKTtcbiAgICAgICAgICAgIGlmIChjc3NDbGFzc2VzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWNsYXNzZXNcIiwgXCJ7XCIgKyBjc3NDbGFzc2VzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKGN1ck5vZGUpO1xuXG5cblxuICAgIH1cblxufSJdfQ==