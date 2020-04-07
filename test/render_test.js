Feature('render');

Scenario('test render', (I) => {

    I.amOnPage("/elem/");
    I.click("#btn1");
    I.see("This is included")
});
