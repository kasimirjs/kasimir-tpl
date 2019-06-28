

class KasimirRenderer {

    constructor(attrPrefix="*") {
        this._attrPrefix = attrPrefix
    }

    /**
     *
     * @param domnode {HTMLElement}
     */
    _getAttributeStr(domnode) {
        let ret = "";
        for (let attr of domnode.attributes)
            ret += " " + attr.name + "=\"" + attr.value + "\"";
        return ret;
    }


    _addslashes(string) {
        return string.replace(/\\/g, '\\\\').
            replace(/\u0008/g, '\\b').
            replace(/\t/g, '\\t').
            replace(/\n/g, '\\n').
            replace(/\f/g, '\\f').
            replace(/\r/g, '\\r').
            replace(/'/g, '\\\'').
            replace(/"/g, '\\"');
    }

    /**
     *
     * @param domnode {HTMLElement}
     * @return
     */
    _getLogic(domnode) {
        let ret = {open:"", close:"", handler:{}};

        if (domnode.hasAttribute(this._attrPrefix + "if")) {
            ret.open += "if(" + domnode.getAttribute(this._attrPrefix + "if") + "){";
            ret.close += "}";
        }
        if (domnode.hasAttribute(this._attrPrefix + "for")) {
            ret.open += "for(" + domnode.getAttribute(this._attrPrefix + "for") + "){";
            ret.close += "}";
        }

        for (let attr of domnode.attributes) {
            let matches = attr.name.match(/^on(.+)/);
            if (matches === null)
                continue;
            ret.handler[attr.name] = attr.value;
        }

        return ret;
    }

    /**
     *
     * @param domnode {Node}
     * @param path {String}
     * @param depth
     */
    _render(domnode, path, depth) {
        let out = "";

        if (domnode instanceof HTMLElement) {

            let logic = this._getLogic(domnode);
            let attrStr = this._getAttributeStr(domnode);
            let curPath = path + " > " + domnode.tagName + attrStr;
            out += "\n" + logic.open;

            out += "\n__debug_path__ = '" + this._addslashes(curPath) + "';";
            if (domnode.tagName === "SCRIPT") {
                out += "\neval(`" + domnode.textContent + "`);"
            } else {
                if (domnode.hasAttribute("is")) {
                    out += "\n_e[" + depth + "] = document.createElement('" + domnode.tagName + "', {is: '" + domnode.getAttribute("is") + "'});";
                } else {
                    out += "\n_e[" + depth + "] = document.createElement('" + domnode.tagName + "');";
                }
                for (let attr of domnode.attributes) {
                    if (attr.name.startsWith(this._attrPrefix))
                        continue;
                    out += "\n_e[" + depth + "].setAttribute('" + attr.name + "', `" + attr.value + "`);";
                }
                for (let handlerName in logic.handler) {
                    out += "\n_e[" + depth + "]." + handlerName + " = function(e){ " + logic.handler[handlerName] + " };";
                }

                out += "\n_e[" + (depth - 1) + "].appendChild(_e[" + depth + "]);";
                // out += "\n__html__ += `<" + domnode.tagName + attrStr + ">`;";
                for (let child of domnode.childNodes) {
                    out += this._render(child, curPath, depth + 1);
                }
            }
            //out += "\n__html__ += `</" + domnode.tagName + ">`;"
            out += "\n" + logic.close;
        } else if (domnode instanceof Text) {
            let curPath = path + " > (text)";
            out += "\n__debug_path__ = '" + this._addslashes(curPath) + "';";
            out += "\n_e[" + (depth-1) +"].appendChild(document.createTextNode(`" + domnode.textContent + "`));";
        }
        return out
    }


    /**
     *
     * @param domnode
     * @return {KasimirTemplate}
     */
    render(domnode) {
        let out = "var __debug_path__ = '(root)';";
        out += "\nvar _e = [document.createElement('div')];";


        if (domnode instanceof HTMLTemplateElement) {

            for (let curChild of domnode.content.childNodes) {
                out += this._render(curChild,  "(root)", 1);
            }
        } else {
            out += this._render(domnode,  "(root)", 1);
        }


        let xout = `
            fn = function(scope){
                let fns = [];
                try {
                    ${out}
                } catch (e) {
                    throw 'Error in ' + __debug_path__ + ': ' + e;
                }
                return _e[0];
            };
        `;

        console.log(xout);
        let fn ;
        eval(xout);
        return new KasimirTemplate(fn);
    }

}

