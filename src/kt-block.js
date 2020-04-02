class KtBlock extends KT_Renderable {

    constructor() {
        super();
        this.state.elements = [];
    }

    conntectedCallback() {

    }

    /*
    onKtInit() {
        this.state.ele
    }
*/

    /**
     *
     * @param {HTMLElement} elem
     * @param scope
     */
    applyLogic(elem, scope) {
        for(let attribName of elem.getAttributeNames()) {
            if (typeof KT_FN[attribName] === "undefined")
                continue;
            let fn = KT_FN[attribName];
            fn(elem, elem.getAttribute(attribName), scope);
        }
    }


    render(scope) {
        "use strict";
        console.log("apply logic");
        for (let elem of this.children) {
            this.applyLogic(elem, scope);
            this.renderRecursive(elem, scope);
        }

    }



}

customElements.define("x-kt-block", KtBlock);