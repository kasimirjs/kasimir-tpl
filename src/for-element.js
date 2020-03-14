class KT_ForElement extends KT_Renderable {

    constructor() {
        super();
        console.log("Forelement construct")
        this.isRendered = false;
    }

    render(scope) {
        //if (! this.isRendered) {
        //    this.appendChild(this.state.origNode.cloneNode(true));
        //    this.isRendered = true;
        //}
        super.render(scope);

    }

}

customElements.define("x-kt-for-element", KT_ForElement);