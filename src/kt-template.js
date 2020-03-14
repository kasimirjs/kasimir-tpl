class KT_Template extends KT_Renderable
{
    constructor(node) {
        super(node);
        this.isRendered = false;
    }

    render(scope) {
        if (this.isRendered === false) {
            $this.appendChild(this.origNode.cloneNode(true));
        }

        for(let i = 0; i < this.parentTpls.length; i++) {
            this.parentTpls[i].render(scope);
        }
    }

}

customElements.define("x-kt-template", KT_Template);