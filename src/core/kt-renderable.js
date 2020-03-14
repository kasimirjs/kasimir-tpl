
class KT_Renderable extends HTMLElement
{


    constructor() {
        super();

        this.state = {
            parentTpls: []

        };

    }


    cloneNode(deep) {
        let state = this.state;
        let x = super.cloneNode(deep);
        x.state = state;
        return x;
    }

    render(scope) {
        for(let i = 0; i < this.state.parentTpls.length; i++) {
            this.state.parentTpls[i].render(scope);
        }
    }

}

