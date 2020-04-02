class KT_ForElement extends KT_Renderable {

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


    render(scope) {
        this.renderRecursive(this. scope);
    }


     */
}

customElements.define("x-kt-block", KT_ForElement);