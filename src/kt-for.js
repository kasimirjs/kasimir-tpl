


class KtFor extends KtRenderable {


    constructor() {
        super();
        this._origSibling = false;
        this._attrs = {
            "forselect": null,
            "foridx": "idx",
            "fordata": null,
            "foreval": null
        }
        this._els = [];
    }

    static get observedAttributes() {
        return ["forselect", "foridx", "fordata", "foreval"];
    }


    render($scope) {
        let _a_sel = this._attrs.forselect;

        let sel = this._hlpr.scopeEval($scope, _a_sel);
        if (typeof sel !== "object") {
            console.warn(`Invalid forSelect="${_a_sel}" returned:`, select, "on context", context, "(Element: ", this.outerHTML, ")");
            throw "Invalid forSelect selector. see waring."
        }

        if (this.origSibling === false)
            this.origSibling = this.nextSibling;

        for (let idx = this._els.length; idx < sel.length; idx++ ) {
            let newNode = this.content.cloneNode(true);
            let nodes = [];
            for (let curNode of newNode.children) {
                curNode._kaMb = this._ktId;
                nodes.push(curNode);
            }
            for (let i = 0; i < nodes.length; i++)
                this.parentElement.insertBefore(nodes[i], this.origSibling);
            this._els.push({
                node: nodes
            });

        }

        for (let idx = 0; idx < sel.length; idx++) {
            $scope[this._attrs.foridx] = idx;
            $scope["self"] = sel[idx];
            if (this._attrs.foreval !== null)
                this._hlpr.keval(this.params.foreval, $scope, this);
            for (let curNode of this._els[idx].node) {
                this.renderRecursive(curNode, $scope);
            }
        }


        for (let idx = this._els.length; sel.length < this._els.length; idx++) {
            let elem = this._els.pop();
            for (let curNode of elem.node) {
                if (typeof curNode._removeNodes === "function")
                    curNode._removeNodes();
                this.parentElement.removeChild(curNode);
            }
        }
    }
}

customElements.define("kt-for", KtFor, {extends: "template"});