const adminStorageKey = "infinineOrders";
const whatsappNumber = "254711922007";

const intro = document.getElementById("intro");
if (intro) {
    setTimeout(() => {
        intro.classList.add("is-hidden");
    }, 4200);
}

function getStoredOrders(){
    try{
        const raw = localStorage.getItem(adminStorageKey);
        return raw ? JSON.parse(raw) : [];
    }catch(error){
        return [];
    }
}

function saveStoredOrders(orders){
    localStorage.setItem(adminStorageKey, JSON.stringify(orders));
}

function generateOrderPdf(order){
    if(!window.jspdf || !window.jspdf.jsPDF){
        return "";
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(2, 6, 23);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('INFININE SMART SOLUTIONS', 14, 20);
    doc.setFontSize(10);
    doc.text('Service Request Record', 14, 30);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    let y = 55;
    const lines = [
        `Order ID: ${order.id}`,
        `Customer Name: ${order.customer}`,
        `Phone: ${order.phone}`,
        `Service: ${order.service}`,
        `Status: ${order.status}`,
        `Date: ${order.createdAt}`,
        '',
        'Client Message:',
        order.message || 'No extra message provided.'
    ];

    lines.forEach(line => {
        doc.text(String(line), 14, y);
        y += 10;
    });

    return doc.output('datauristring');
}

function saveOrderToAdmin(order){
    const orders = getStoredOrders();
    orders.unshift(order);
    saveStoredOrders(orders);
}


/* =========================
   SERVICE CARDS
========================= */

function openWhatsAppForService(service){

    const order = {
        id: `INV-${Date.now()}`,
        customer: "Walk-in customer",
        phone: "Not provided",
        service,
        message: `Requested service: ${service}. Customer clicked the quick service request option from the homepage.`,
        status: "New",
        createdAt: new Date().toISOString()
    };

    order.pdfData = generateOrderPdf(order);
    saveOrderToAdmin(order);

    const message =
        `Hello Infinine Smart Solutions 👋\n\nI would like to request the "${service}" service. Please assist me with this service.`;

    const url =
        "https://wa.me/" +
        whatsappNumber +
        "?text=" +
        encodeURIComponent(message);

    window.open(url, "_blank");

}

document.querySelectorAll(".service-card").forEach(card => {

    card.addEventListener("click", function(){

        const service =
            this.getAttribute("data-service");

        document.getElementById("service").value =
            service;

        if(service){
            openWhatsAppForService(service);
        }

    });

});


/* =========================
   SEARCH
========================= */

const search =
    document.getElementById("search");

const noResults =
    document.getElementById("noResults");

search.addEventListener("input", function(){

    const value =
        this.value.toLowerCase().trim();

    let found = 0;

    document.querySelectorAll(".category").forEach(category => {

        let categoryFound = 0;

        category.querySelectorAll(".service-card").forEach(card => {

            const text =
                card.innerText.toLowerCase();

            if(text.includes(value)){

                card.style.display = "block";

                categoryFound++;
                found++;

            }else{

                card.style.display = "none";

            }

        });

        if(categoryFound > 0 || value === ""){

            category.style.display = "block";

        }else{

            category.style.display = "none";

        }

    });

    noResults.style.display =
        found === 0 ? "block" : "none";

});


/* =========================
   FORM
========================= */

document
.getElementById("serviceForm")
.addEventListener("submit", function(e){

    e.preventDefault();

    const customer =
        document.getElementById("name").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const service =
        document.getElementById("service").value.trim();

    const message =
        document.getElementById("message").value.trim();

    if(!customer || !phone || !service || !message){
        alert("Please fill in all fields before sending your request.");
        return;
    }

    const order = {
        id: `INV-${Date.now()}`,
        customer,
        phone,
        service,
        message,
        status: "New",
        createdAt: new Date().toISOString()
    };

    order.pdfData = generateOrderPdf(order);
    saveOrderToAdmin(order);

    const whatsappMessage =
`Hello Infinine Smart Solutions 👋

I would like to request the following service:

Order ID: ${order.id}
Customer Name: ${customer}
Phone: ${phone}
Service: ${service}

Message:
${message}`;

    const url =
        "https://wa.me/" +
        whatsappNumber +
        "?text=" +
        encodeURIComponent(whatsappMessage);

    window.open(url,"_blank");

});

const feedbackYes = document.getElementById("feedbackYes");
const feedbackResponse = document.getElementById("feedbackResponse");

feedbackYes.addEventListener("click", function(){
    const message = "Thank you for your feedback. We’re glad you’re satisfied with our services.";
    feedbackResponse.textContent = message;
    window.alert(message);
});
