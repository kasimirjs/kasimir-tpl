class KT_Template extends KT_Renderable
{
    constructor() {
        super();
        this.isRendered = false;
    }

    render(scope) {
        if (this.isRendered === false) {
            this.appendChild(this.state.origNode.cloneNode(true));
            this.isRendered = true;
        }

        for(let i = 0; i < this.state.parentTpls.length; i++) {
            this.state.parentTpls[i].render(scope);
        }
        console.log("Dump from tpl: ", this.dump());
    }

    /**
     *
     * @param targetNode
     * @return {KT_Template}
     */
    mount(targetNode) {


        return this;
    }

}

customElements.define("x-kt-template", KT_Template);
