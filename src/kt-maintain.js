


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
        this.removeNode();
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