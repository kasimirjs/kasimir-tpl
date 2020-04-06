class KtInclude extends KT_Renderable {

    onAfterKtInit() {
        if ( ! this.hasAttribute("kt-id")) {
            this.setAttribute("kt-id", KT_DATA.length)
        }
        KT_DATA.push({origNode: null});


    }

    connectedCallback() {
        let src = this.getAttribute("src");

        let xhttp = new XMLHttpRequest();

        xhttp.open("GET", src);
        xhttp.onreadystatechange = () => {
            if (xhttp.readyState === 4) {
                if (xhttp.status >= 400) {
                    console.warn("Can't load '" + src + "': " + xhttp.responseText);
                    return;
                }
                this.innerHTML = xhttp.responseText;
                return;
            }

        };

        xhttp.send();
    }

    render(scope) {


    }


}

customElements.define("x-kt-include", KtInclude);
