


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