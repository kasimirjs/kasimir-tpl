

class KTVal extends HTMLElement {



    render(scope) {
        let select = this.getAttribute("select");
        this.innerText = scope[select];
    }


}

customElements.define("x-kt-val", KTVal);