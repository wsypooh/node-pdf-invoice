const moment = require("moment");
var http = require('http');
const fs = require('fs');
var path = require("path");
const axios = require('axios');

const getInvoiceTemplate = async (params) => {
  try{
    const html = fs.readFileSync(path.resolve(__dirname, "invoice.html"), { encoding:'utf8' });
    return html;
  }
  catch (err) {
    if (err.code === 'ENOENT') {
      console.log('File not found!');
    } 
    return "";
  }
}

const getInvoiceDummyData = async (params) => {
  var data = 
  {
    "billing": {
        "usage": [
          {  

            "billingCycleEnd": "2022-06-01T14:16:44.014+00:00",
            "status" : "paid", 
            "orderId": "2022-08-26_invoice",

            "billingData": {
                "city": "New York",
                "country": "US",
                "email": "user1@gmail.com",
                "addressLine1": "123 Wee Street",
                "addressLine2": null,
                "name": "John Doe",
                "postalCode": "1234",
                "state": "NY",
                "taxPercent": 10,
             },

            "items": [ 
                {
                    "qty": 1,
                    "friendlyPlan": "My Plan 1",
                    "price": 5,
                    "amount": 5,
                },
                {
                    "qty": 2,
                    "friendlyPlan": "My Plan 2",
                    "price": 2,
                    "amount": 4,
                },
                {
                    "qty": 1,
                    "friendlyPlan": "My Plan 3",
                    "price": 5,
                    "amount": 5,
                },
            ],
            "subTotalAmount": 18.00,
            "totalAmount": 18.00, 
          },
        ]
    }
  }

  return data;
}

function fill (template, data) {

  Object.keys(data).forEach(function (key) {
    var placeholder = "{{" + key + "}}";
    var value = data[key];
    while (template.indexOf(placeholder) !== -1) {
      template = template.replace(placeholder, value);
    }
  });

  return template;
}

function fillList (template, dataArray) {
  var listString = "";
    
  dataArray.forEach(function (data) {
    listString += fill(template, data);
  });
    
  return listString;
}

const getInvoiceHtml = async (params) => {
  let dollarUS = Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  let percent = Intl.NumberFormat('default', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const html = await getInvoiceTemplate();
  if (html === ""){
    return "";
  }
  else{
    var dataFromDB = await getInvoiceDummyData();
    var usage = dataFromDB.billing.usage[0];

    var data = {
      invoice_number: usage.orderId,
      billing_date: moment(usage.billingCycleEnd).format("D MMM YYYY"),
      name: !!usage.billingData.name ? usage.billingData.name : "",
      addressLine1: !!usage.billingData.addressLine1 ? usage.billingData.addressLine1 : "",
      addressLine2: !!usage.billingData.addressLine2 ? usage.billingData.addressLine2 : "",
      city: !!usage.billingData.city ? usage.billingData.city : "",
      state: !!usage.billingData.state ? usage.billingData.state : "",
      country: !!usage.billingData.country ? usage.billingData.country : "",
      postalCode: !!usage.billingData.postalCode ? usage.billingData.postalCode : "",
      email: !!usage.billingData.email ? usage.billingData.email : "",
      total: dollarUS.format(usage.totalAmount),
      subTotal: dollarUS.format(usage.totalAmount),
      tax: !!usage.tax ? dollarUS.format(usage.tax) : "$0.00",
      downloadUrl : "http://localhost:8082",
      items: "",
      podUsage:[],
      status: usage.status,
      hidden: params ? "" : "-hidden"
    };

    for (i = 0; i < usage.items.length; i++) {
        planItem = usage.items[i];
        data.podUsage.push(
          {
            item: planItem.friendlyPlan,
            qty: planItem.qty,
            price: dollarUS.format(planItem.price),
            subtotal: dollarUS.format(planItem.amount),
          }
        )
    } 

    const lineTemplate = '<tr><td>{{item}}</td><td>{{qty}}</td><td>{{price}}</td><td>{{subtotal}}</td></tr>';
    data.items = fillList(lineTemplate, data.podUsage);
    
    const merged = fill(html, data);
    return merged;
  }
}

const showInvoice =  async () => {
    http.createServer(async function (req, res) {
        var html = await getInvoiceHtml(true);
        res.writeHead(200, {'Content-Type': 'text/html'});
        if (html === ""){
          res.end('Error');
        }
        else{
          res.end(html);
        }
    }).listen(8081);
}

const viewPdf = async () => {

    http.createServer(async function (req, res) {

      var html = await getInvoiceHtml(false);
      res.writeHead(200, {'Content-Type': 'text/html'});
      if (html === ""){
        res.end('Error');
      }
      else{
  
        let url = "https://api.html2pdfrocket.com/pdf";
        var apiKey = "replace-with-your-api-key";

        // Additional parameters can be added here
        var payload = "margintop=3&apikey=" + apiKey + "&value=" + encodeURIComponent(html);

        const headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
          'encoding': 'binary'
        }

        try{
              let resPdf = await axios({url: url, 
              method: 'post',
              responseType: "arraybuffer",
              responseEncoding: "binary",
              data: payload, 
              headers: { headers }});

              res.writeHead(200, {'Content-Type': 'application/pdf', 'content-disposition': 'attachment; filename=download.pdf'});
              res.end(resPdf.data);
        }
        catch(err){
          console.log(err);
          res.end('Error');
        }
    }

  }).listen(8082);
}

showInvoice();
viewPdf();