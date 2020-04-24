


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
        let sel = this._hlpr.scopeEval($scope, _a_sel);

        if (typeof sel !== "object") {
            console.warn(`Invalid forSelect="${_a_sel}" returned:`, select, "on context", context, "(Element: ", this.outerHTML, ")");
            throw "Invalid forSelect selector. see waring."
        }

        if (sel === null || typeof sel[Symbol.iterator] !== "function") {
            this._log(`Selector '${_a_sel}' in for statement is not iterable. Returned value: `, sel, "in", this.outerHTML);
            console.warn(`Selector '${_a_sel}' in for statement is not iterable. Returned value: `, sel, "in", this.outerHTML)
            return;
        }

        if (this._origSibling === false)
            this._origSibling = this.nextSibling;


        let n = 0;
        switch (this._attrs.formode) {
            case "in":
                for(n in sel) {
                    $scope[this._attrs.fordata] = n;
                    this._maintainNode(n, $scope);
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
                    n++;
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