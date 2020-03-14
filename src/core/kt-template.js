class KT_Template extends KT_Renderable
{
    constructor() {
        super();
        this.isRendered = false;
    }

    render(scope) {
        if (this.isRendered === false) {
            this.appendChild(this.origNode.cloneNode(true));
            this.isRendered = true;
        }

        for(let i = 0; i < this.state.parentTpls.length; i++) {
            this.state.parentTpls[i].render(scope);
        }
    }

}

customElements.define("x-kt-template", KT_Template);