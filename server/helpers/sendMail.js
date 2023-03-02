const ErrLog = require('../models/webLogger')
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const dotenv = require('dotenv')
dotenv.config()


async function sendEmail(email, subject, body) {
  try {
    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(process.env.SENDGRID_API)

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      html: body,
    }
    return await sgMail.send(msg)
  } catch (err) {
    ErrLog.create({
      message: err.message,
      name: err.name,
      endpoint: 'sendEmail',
      stack: err.stack,
    }).catch(err2 => {
      console.log(err2)
    })
  }
}


function sendWelcomeEmailToUser( user, password ) {

  let userRole = 'User';
  let message = '';

  switch (user.role) {
    case 1:
      userRole = 'User';
      message = fs.readFileSync(
        path.join(__dirname, '../', 'mailTemplates/', 'user-created-email.html'),
        'utf8'
      )
      break;
    case 2:
      userRole = 'Logistics';
      message = fs.readFileSync(
        path.join(__dirname, '../', 'mailTemplates/', 'user-created-email-by-admin.html'),
        'utf8'
      )
      break;
  }

  message = parseHTMLVariables(
    [
      {
        name: 'CLIENT_URL',
        value: process.env.CLIENT_URL
      },
      {
        name: 'fullName',
        value: user.firstName + ' ' + user.lastName
      },
      {
        name: 'name',
        value: user.firstName
      },
      {
        name: 'userRole',
        value: userRole
      },
      {
        name: 'password',
        value: password
      }
    ],
    message
  )
  return sendEmail(user.email, 'User Created @ ShypIndia', message);
}


function sendResetPassword(email, token, username) {
  let message = fs.readFileSync(
    path.join(__dirname, '../', 'mailTemplates/', 'forgotPassword.html'),
    'utf8'
  )
  message = parseHTMLVariables(
    [
      {
        name: 'forgotLink',
        value: `${process.env.CLIENT_URL}/verify?id=${token}`,
      },
      {
        name: 'username',
        value: username,
      },
    ],
    message
  )
  return sendEmail(email, 'Password reset @ ShypIndia', message)
}


function sendResetPasswordByAdmin(email, token, username) {
  let message = fs.readFileSync(
    path.join(__dirname, '../', 'mailTemplates/', 'resetPasswordByAdmin.html'),
    'utf8'
  )
  message = parseHTMLVariables(
    [
      {
        name: 'forgotLink',
        value: `${process.env.CLIENT_URL}/verify?id=${token}`,
      },
      {
        name: 'username',
        value: username,
      },
    ],
    message
  )
  return sendEmail(email, 'Password reset @ ShypIndia', message)
}

function sendPackageCreatedByUser(
  email,
  username,
  trackingNumber,
  deliveryMode,
  deliveryPickup,
  warehouse,
  package
) {

  try {

    /*
    let message = fs.readFileSync(
      path.join(__dirname, '../', 'mailTemplates/', 'packageCreated.html'),
      'utf8'
    )
    message = parseHTMLVariables(
      [
        {
          name: 'username',
          value: username
        },
        {
          name: 'trackingNumber',
          value: trackingNumber
        },
        {
          name: 'deliveryMode',
          value: deliveryMode
        },
        {
          name: 'deliveryPickup',
          value: deliveryPickup
        },
        {
          name: 'warehouse',
          value: warehouse
        },
      ],
      message
    )
    var packageCreatedEmail = sendEmail(email, 'Package created @ ShypIndia', message)
    */

    // Tracking Message
    let tracking_message = fs.readFileSync(
      path.join(__dirname, '../', 'mailTemplates/', 'tracking.html'),
      'utf8'
    )
    var trackingCols = `
    <div class="col">
      <div class="step__content">
        <p>Ordered</p>
        <p>` + moment(package.createdAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.createdAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col empty-col">
      <div class="step__content">

      </div>
    </div>

    <div class="col">
      <div class="step__content">
        <p>` + ( ( deliveryMode == 'Pickup' ) ? `Pickup` : `Delivery` )  + `</p>
        <p></p>
      </div>
    </div>
    `;

    var updatesRows = `
    <tr>
      <td>
        ` + moment(package.createdAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Ordered</p>
      </td>
    </tr>
    `;

    tracking_message = parseHTMLVariables(
      [
        {
          name: 'tracking_progress',
          value: '15%'
        },
        {
          name: 'trackingCols',
          value: trackingCols
        },
        {
          name: 'updatesRows',
          value: updatesRows
        },
        {
          name: 'CLIENT_URL',
          value: process.env.CLIENT_URL
        }
      ],
      tracking_message
    )
    var package_created_tracking_message = sendEmail(email, 'Package created @ ShypIndia', tracking_message)
    return;

  } catch (e) {

    console.log( 'e', e );

  } finally {

  }

}


function sendPackageCreatedByLogistics(
  email,
  username,
  trackingNumber,
  warehouse,
  createdAt
) {

  try {

    // let message = fs.readFileSync(
    //   path.join(
    //     __dirname,
    //     '../',
    //     'mailTemplates/',
    //     'packageCreatedByLogistics.html'
    //   ),
    //   'utf8'
    // )
    // message = parseHTMLVariables(
    //   [
    //     {
    //       name: 'username',
    //       value: username
    //     },
    //     {
    //       name: 'trackingNumber',
    //       value: trackingNumber
    //     },
    //     {
    //       name: 'warehouse',
    //       value: warehouse
    //     },
    //   ],
    //   message
    // )
    // sendEmail(email, 'Package created @ ShypIndia', message)


    // Tracking Message
    let tracking_message = fs.readFileSync(
      path.join(__dirname, '../', 'mailTemplates/', 'tracking.html'),
      'utf8'
    )
    var trackingCols = `
    <div class="col">
      <div class="step__content">
        <p>Ordered</p>
        <p>` + moment(createdAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(createdAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col empty-col">
      <div class="step__content">

      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Pick up/Delivery</p>
        <p></p>
      </div>
    </div>
    `;

    var updatesRows = `
    <tr>
      <td>
        ` + moment(createdAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Ordered</p>
      </td>
    </tr>
    `;

    tracking_message = parseHTMLVariables(
      [
        {
          name: 'tracking_progress',
          value: '15%'
        },
        {
          name: 'trackingCols',
          value: trackingCols
        },
        {
          name: 'updatesRows',
          value: updatesRows
        },
        {
          name: 'CLIENT_URL',
          value: process.env.CLIENT_URL
        }
      ],
      tracking_message
    )
    var package_created_tracking_message = sendEmail(email, 'Package created @ ShypIndia', tracking_message)
    return;

  } catch (e) {

    console.log( 'e', e );

  } finally {

  }

}


function sendPackageArrived(
  email,
  username,
  trackingNumber,
  deliveryMode,
  deliveryPickup,
  warehouse,
  package
) {

  try {

    // let message = fs.readFileSync(
    //   path.join(__dirname, '../', 'mailTemplates/', 'packageArrived.html'),
    //   'utf8'
    // )
    // message = parseHTMLVariables(
    //   [
    //     {
    //       name: 'username',
    //       value: username
    //     },
    //     {
    //       name: 'trackingNumber',
    //       value: trackingNumber
    //     },
    //     {
    //       name: 'deliveryMode',
    //       value: deliveryMode
    //     },
    //     {
    //       name: 'deliveryPickup',
    //       value: deliveryPickup
    //     },
    //     {
    //       name: 'warehouse',
    //       value: warehouse
    //     },
    //   ],
    //   message
    // )
    // sendEmail(email, 'Package arrived @ ShypIndia', message)



    // Tracking Message
    let tracking_message = fs.readFileSync(
      path.join(__dirname, '../', 'mailTemplates/', 'tracking.html'),
      'utf8'
    )
    var trackingCols = `
    <div class="col">
      <div class="step__content">
        <p>Ordered</p>
        <p>` + moment(package.createdAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.createdAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Arrived at warehouse</p>
        <p>` + moment(package.packageArrivedAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.packageArrivedAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col empty-col">
      <div class="step__content">

      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>` + ( ( deliveryMode == 'Pickup' ) ? `Pickup` : `Delivery` )  + `</p>
        <p></p>
      </div>
    </div>
    `;

    var updatesRows = `
    <tr>
      <td>
        ` + moment(package.packageArrivedAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Arrived at warehouse</p>
        <p>` + package.warehouse.templateName + `</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.createdAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Ordered</p>
      </td>
    </tr>
    `;

    tracking_message = parseHTMLVariables(
      [
        {
          name: 'tracking_progress',
          value: '35%'
        },
        {
          name: 'trackingCols',
          value: trackingCols
        },
        {
          name: 'updatesRows',
          value: updatesRows
        },
        {
          name: 'CLIENT_URL',
          value: process.env.CLIENT_URL
        }
      ],
      tracking_message
    )

    var package_arrived_tracking_message = sendEmail(email, 'Package arrived @ ShypIndia', tracking_message)
    return;
  } catch (e) {
    console.log( 'e', e );
  } finally {

  }

}


function sendPackageRequiresAction(
  email,
  username,
  trackingNumber,
  deliveryMode,
  deliveryPickup,
  warehouse,
  weight,
  package
) {

  let message = fs.readFileSync(
    path.join(__dirname, '../', 'mailTemplates/', 'packageRequiresAction.html'),
    'utf8'
  )
  message = parseHTMLVariables(
    [
      {
        name: 'username',
        value: username
      },
      {
        name: 'trackingNumber',
        value: trackingNumber
      },
      {
        name: 'deliveryMode',
        value: deliveryMode
      },
      {
        name: 'deliveryPickup',
        value: deliveryPickup
      },
      {
        name: 'warehouse',
        value: warehouse
      },
      {
        name: 'weight',
        value: weight
      },
      {
        name: 'CLIENT_URL',
        value: process.env.CLIENT_URL
      }
    ],
    message
  )
  sendEmail(email, 'Package requires actions @ ShypIndia', message)
  return;

}

function sendPackagePaid(
  email,
  username,
  trackingNumber,
  deliveryMode,
  deliveryPickup,
  warehouse,
  weight,
  package
) {

  // let message = fs.readFileSync(
  //   path.join(__dirname, '../', 'mailTemplates/', 'packagePaid.html'),
  //   'utf8'
  // )
  // message = parseHTMLVariables(
  //   [
  //     {
  //       name: 'username',
  //       value: username
  //     },
  //     {
  //       name: 'trackingNumber',
  //       value: trackingNumber
  //     },
  //     {
  //       name: 'deliveryMode',
  //       value: deliveryMode
  //     },
  //     {
  //       name: 'deliveryPickup',
  //       value: deliveryPickup
  //     },
  //     {
  //       name: 'warehouse',
  //       value: warehouse
  //     },
  //     {
  //       name: 'weight',
  //       value: weight
  //     },
  //   ],
  //   message
  // )
  // sendEmail(email, 'Package paid @ ShypIndia', message)


  // Tracking Message
  let tracking_message = fs.readFileSync(
    path.join(__dirname, '../', 'mailTemplates/', 'tracking.html'),
    'utf8'
  )
  var trackingCols = `
  <div class="col">
    <div class="step__content">
      <p>Ordered</p>
      <p>` + moment(package.createdAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.createdAt).format('HH:mm') + `</p>
    </div>
  </div>

  <div class="col">
    <div class="step__content">
      <p>Arrived at warehouse</p>
      <p>` + moment(package.packageArrivedAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.packageArrivedAt).format('HH:mm') + `</p>
    </div>
  </div>

  <div class="col">
    <div class="step__content">
      <p>Paid</p>
      <p>` + moment(package.paidAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.paidAt).format('HH:mm') + `</p>
    </div>
  </div>

  <div class="col empty-col">
    <div class="step__content">

    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>` + ( ( deliveryMode == 'Pickup' ) ? `Pickup` : `Delivery` )  + `</p>
      <p></p>
    </div>
  </div>
  `;

  var updatesRows = `
  <tr>
    <td>
      ` + moment(package.paidAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Paid</p>
    </td>
  </tr>

  <tr>
    <td>
      ` + moment(package.packageArrivedAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Arrived at warehouse</p>
      <p>` + package.warehouse.templateName + `</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.createdAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Ordered</p>
    </td>
  </tr>
  `;

  tracking_message = parseHTMLVariables(
    [
      {
        name: 'tracking_progress',
        value: '50%'
      },
      {
        name: 'trackingCols',
        value: trackingCols
      },
      {
        name: 'updatesRows',
        value: updatesRows
      },
      {
        name: 'CLIENT_URL',
        value: process.env.CLIENT_URL
      }
    ],
    tracking_message
  )

  var package_paid_tracking_message = sendEmail(email, 'Package paid @ ShypIndia', tracking_message)
  return;
}


function sendPackageReadyToShip(
  email,
  username,
  trackingNumber,
  deliveryMode,
  deliveryPickup,
  warehouse,
  weight,
  package
) {


  try {

    // let message = fs.readFileSync(
    //   path.join(__dirname, '../', 'mailTemplates/', 'packageReadyToShip.html'),
    //   'utf8'
    // )
    // message = parseHTMLVariables(
    //   [
    //     {
    //       name: 'username',
    //       value: username
    //     },
    //     {
    //       name: 'trackingNumber',
    //       value: trackingNumber
    //     },
    //     {
    //       name: 'deliveryMode',
    //       value: deliveryMode
    //     },
    //     {
    //       name: 'deliveryPickup',
    //       value: deliveryPickup
    //     },
    //     {
    //       name: 'warehouse',
    //       value: warehouse
    //     },
    //     {
    //       name: 'weight',
    //       value: weight
    //     },
    //   ],
    //   message
    // )
    // sendEmail(email, 'Package ready to ship @ ShypIndia', message)


    // Tracking Message
    let tracking_message = fs.readFileSync(
      path.join(__dirname, '../', 'mailTemplates/', 'tracking.html'),
      'utf8'
    )
    var trackingCols = `
    <div class="col">
      <div class="step__content">
        <p>Ordered</p>
        <p>` + moment(package.createdAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.createdAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Arrived at warehouse</p>
        <p>` + moment(package.packageArrivedAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.packageArrivedAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Paid</p>
        <p>` + moment(package.paidAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.paidAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Ready to ship</p>
        <p>` + moment(package.readyToShipAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.readyToShipAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col empty-col">
      <div class="step__content">

      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Delivery</p>
        <p></p>
      </div>
    </div>
    `;

    var updatesRows = `
    <tr>
      <td>
        ` + moment(package.readyToShipAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Ready to ship</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.paidAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Paid</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.packageArrivedAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Arrived at warehouse</p>
        <p>` + package.warehouse.templateName + `</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.createdAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Ordered</p>
      </td>
    </tr>
    `;

    tracking_message = parseHTMLVariables(
      [
        {
          name: 'tracking_progress',
          value: '60%'
        },
        {
          name: 'trackingCols',
          value: trackingCols
        },
        {
          name: 'updatesRows',
          value: updatesRows
        },
        {
          name: 'CLIENT_URL',
          value: process.env.CLIENT_URL
        }
      ],
      tracking_message
    )

    var package_readyToShip_tracking_message = sendEmail(email, 'Package ready to ship @ ShypIndia', tracking_message)

    return;
  } catch (e) {

    console.log( 'e', e );

  } finally {

  }
}


function sendPackageReadyToPickup(
  email,
  username,
  trackingNumber,
  deliveryMode,
  deliveryPickup,
  warehouse,
  weight,
  package
) {

  try {

    // let message = fs.readFileSync(
    //   path.join(__dirname, '../', 'mailTemplates/', 'packageReadyToPickup.html'),
    //   'utf8'
    // )
    // message = parseHTMLVariables(
    //   [
    //     {
    //       name: 'username',
    //       value: username
    //     },
    //     {
    //       name: 'trackingNumber',
    //       value: trackingNumber
    //     },
    //     {
    //       name: 'deliveryMode',
    //       value: deliveryMode
    //     },
    //     {
    //       name: 'deliveryPickup',
    //       value: deliveryPickup
    //     },
    //     {
    //       name: 'warehouse',
    //       value: warehouse
    //     },
    //     {
    //       name: 'weight',
    //       value: weight
    //     },
    //   ],
    //   message
    // )
    // sendEmail(email, 'Package Ready to pickup @ ShypIndia', message)


    // Tracking Message
    let tracking_message = fs.readFileSync(
      path.join(__dirname, '../', 'mailTemplates/', 'tracking.html'),
      'utf8'
    )
    var trackingCols = `
    <div class="col">
      <div class="step__content">
        <p>Ordered</p>
        <p>` + moment(package.createdAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.createdAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Arrived at warehouse</p>
        <p>` + moment(package.packageArrivedAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.packageArrivedAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Paid</p>
        <p>` + moment(package.paidAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.paidAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Ready to pickup</p>
        <p>` + moment(package.readyToShipAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.readyToShipAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col empty-col">
      <div class="step__content">

      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Pick up</p>
        <p></p>
      </div>
    </div>
    `;

    var updatesRows = `
    <tr>
      <td>
        ` + moment(package.readyToShipAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Ready to pickup</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.paidAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Paid</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.packageArrivedAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Arrived at warehouse</p>
        <p>` + package.warehouse.templateName + `</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.createdAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Ordered</p>
      </td>
    </tr>
    `;

    tracking_message = parseHTMLVariables(
      [
        {
          name: 'tracking_progress',
          value: '60%'
        },
        {
          name: 'trackingCols',
          value: trackingCols
        },
        {
          name: 'updatesRows',
          value: updatesRows
        },
        {
          name: 'CLIENT_URL',
          value: process.env.CLIENT_URL
        }
      ],
      tracking_message
    )

    var package_readyToPickUp_tracking_message = sendEmail(email, 'Package Ready to pickup @ ShypIndia', tracking_message)

    return
  } catch (e) {

    console.log( 'e', e );

  } finally {

  }
}


function sendPackageOutOnDelivery(
  email,
  username,
  trackingNumber,
  deliveryMode,
  deliveryPickup,
  warehouse,
  weight,
  package
) {


  // let message = fs.readFileSync(
  //   path.join(__dirname, '../', 'mailTemplates/', 'packageOutOnDelivery.html'),
  //   'utf8'
  // )
  // message = parseHTMLVariables(
  //   [
  //     {
  //       name: 'username',
  //       value: username
  //     },
  //     {
  //       name: 'trackingNumber',
  //       value: trackingNumber
  //     },
  //     {
  //       name: 'deliveryMode',
  //       value: deliveryMode
  //     },
  //     {
  //       name: 'deliveryPickup',
  //       value: deliveryPickup
  //     },
  //     {
  //       name: 'warehouse',
  //       value: warehouse
  //     },
  //     {
  //       name: 'weight',
  //       value: weight
  //     },
  //   ],
  //   message
  // )
  // sendEmail(email, 'Package is being delivered @ ShypIndia', message)

  // Tracking Message
  let tracking_message = fs.readFileSync(
    path.join(__dirname, '../', 'mailTemplates/', 'tracking.html'),
    'utf8'
  )
  var trackingCols = `
  <div class="col">
    <div class="step__content">
      <p>Ordered</p>
      <p>` + moment(package.createdAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.createdAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Arrived at warehouse</p>
      <p>` + moment(package.packageArrivedAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.packageArrivedAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Paid</p>
      <p>` + moment(package.paidAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.paidAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Ready to ship</p>
      <p>` + moment(package.readyToShipAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.readyToShipAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Out for delivery</p>
      <p>` + moment(package.outForDeliveryAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.outForDeliveryAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Delivery</p>
      <p></p>
    </div>
  </div>
  `;

  var updatesRows = `
  <tr>
    <td>
      ` + moment(package.outForDeliveryAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Out for delivery</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.readyToShipAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Ready to ship</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.paidAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Paid</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.packageArrivedAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Arrived at warehouse</p>
      <p>` + package.warehouse.templateName + `</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.createdAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Ordered</p>
    </td>
  </tr>
  `;

  tracking_message = parseHTMLVariables(
    [
      {
        name: 'tracking_progress',
        value: '80%'
      },
      {
        name: 'trackingCols',
        value: trackingCols
      },
      {
        name: 'updatesRows',
        value: updatesRows
      },
      {
        name: 'CLIENT_URL',
        value: process.env.CLIENT_URL
      }
    ],
    tracking_message
  )
  var package_OutOnDelivery_tracking_message = sendEmail(email, 'Package is being delivered @ ShypIndia', tracking_message)

  return;
}

function sendPackageShipped(
  email,
  username,
  trackingNumber,
  deliveryMode,
  deliveryPickup,
  warehouse,
  weight,
  package
) {


  // let message = fs.readFileSync(
  //   path.join(__dirname, '../', 'mailTemplates/', 'packageShipped.html'),
  //   'utf8'
  // )
  // message = parseHTMLVariables(
  //   [
  //     {
  //       name: 'username',
  //       value: username
  //     },
  //     {
  //       name: 'trackingNumber',
  //       value: trackingNumber
  //     },
  //     {
  //       name: 'deliveryMode',
  //       value: deliveryMode
  //     },
  //     {
  //       name: 'deliveryPickup',
  //       value: deliveryPickup
  //     },
  //     {
  //       name: 'warehouse',
  //       value: warehouse
  //     },
  //     {
  //       name: 'weight',
  //       value: weight
  //     },
  //   ],
  //   message
  // )
  // sendEmail(email, 'Package shipped @ ShypIndia', message)


  // Tracking Message
  let tracking_message = fs.readFileSync(
    path.join(__dirname, '../', 'mailTemplates/', 'tracking.html'),
    'utf8'
  )
  var trackingCols = `
  <div class="col">
    <div class="step__content">
      <p>Ordered</p>
      <p>` + moment(package.createdAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.createdAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Arrived at warehouse</p>
      <p>` + moment(package.packageArrivedAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.packageArrivedAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Paid</p>
      <p>` + moment(package.paidAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.paidAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Ready to ship</p>
      <p>` + moment(package.readyToShipAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.readyToShipAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Out for delivery</p>
      <p>` + moment(package.outForDeliveryAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.outForDeliveryAt).format('HH:mm') + `</p>
    </div>
  </div>
  <div class="col">
    <div class="step__content">
      <p>Shipped</p>
      <p>` + moment(package.shippedAt).format('YYYY/MM/DD') + `</p>
      <p>` + moment(package.shippedAt).format('HH:mm') + `</p>
    </div>
  </div>
  `;

  var updatesRows = `
  <tr>
    <td>
      ` + moment(package.shippedAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Shipped</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.outForDeliveryAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Out for delivery</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.readyToShipAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Ready to ship</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.paidAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Paid</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.packageArrivedAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Arrived at warehouse</p>
      <p>` + package.warehouse.templateName + `</p>
    </td>
  </tr>
  <tr>
    <td>
      ` + moment(package.createdAt).format('YYYY/MM/DD - HH:mm') + `
    </td>
    <td>-</td>
    <td>
      <p>Ordered</p>
    </td>
  </tr>
  `;

  tracking_message = parseHTMLVariables(
    [
      {
        name: 'tracking_progress',
        value: '100%'
      },
      {
        name: 'trackingCols',
        value: trackingCols
      },
      {
        name: 'updatesRows',
        value: updatesRows
      },
      {
        name: 'CLIENT_URL',
        value: process.env.CLIENT_URL
      }
    ],
    tracking_message
  )
  var package_shipped_tracking_message = sendEmail(email, 'Package shipped @ ShypIndia', tracking_message)

  return;
}





function sendPackagePickedUp(
  email,
  username,
  trackingNumber,
  deliveryMode,
  deliveryPickup,
  warehouse,
  weight,
  package
) {

  try {

    // let message = fs.readFileSync(
    //   path.join(__dirname, '../', 'mailTemplates/', 'packagePickedUp.html'),
    //   'utf8'
    // )
    // message = parseHTMLVariables(
    //   [
    //     {
    //       name: 'username',
    //       value: username
    //     },
    //     {
    //       name: 'trackingNumber',
    //       value: trackingNumber
    //     },
    //     {
    //       name: 'deliveryMode',
    //       value: deliveryMode
    //     },
    //     {
    //       name: 'deliveryPickup',
    //       value: deliveryPickup
    //     },
    //     {
    //       name: 'warehouse',
    //       value: warehouse
    //     },
    //     {
    //       name: 'weight',
    //       value: weight
    //     },
    //   ],
    //   message
    // )
    // sendEmail(email, 'Package picked up @ ShypIndia', message)


    // Tracking Message
    let tracking_message = fs.readFileSync(
      path.join(__dirname, '../', 'mailTemplates/', 'tracking.html'),
      'utf8'
    )
    var trackingCols = `
    <div class="col">
      <div class="step__content">
        <p>Ordered</p>
        <p>` + moment(package.createdAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.createdAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Arrived at warehouse</p>
        <p>` + moment(package.packageArrivedAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.packageArrivedAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Paid</p>
        <p>` + moment(package.paidAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.paidAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Ready to pickup</p>
        <p>` + moment(package.readyToShipAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.readyToShipAt).format('HH:mm') + `</p>
      </div>
    </div>
    <div class="col">
      <div class="step__content">
        <p>Picked up</p>
        <p>` + moment(package.pickedupAt).format('YYYY/MM/DD') + `</p>
        <p>` + moment(package.pickedupAt).format('HH:mm') + `</p>
      </div>
    </div>
    `;

    var updatesRows = `
    <tr>
      <td>
        ` + moment(package.pickedupAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Picked up</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.readyToShipAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Ready to pickup</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.paidAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Paid</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.packageArrivedAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Arrived at warehouse</p>
        <p>` + package.warehouse.templateName + `</p>
      </td>
    </tr>
    <tr>
      <td>
        ` + moment(package.createdAt).format('YYYY/MM/DD - HH:mm') + `
      </td>
      <td>-</td>
      <td>
        <p>Ordered</p>
      </td>
    </tr>
    `;

    tracking_message = parseHTMLVariables(
      [
        {
          name: 'tracking_progress',
          value: '100%'
        },
        {
          name: 'trackingCols',
          value: trackingCols
        },
        {
          name: 'updatesRows',
          value: updatesRows
        },
        {
          name: 'CLIENT_URL',
          value: process.env.CLIENT_URL
        }
      ],
      tracking_message
    )

    var package_pickedUp_tracking_message = sendEmail(email, 'Package picked up @ ShypIndia', tracking_message)

    return;
  } catch (e) {

    console.log( 'e', e );

  } finally {

  }

}


function parseHTMLVariables(variables, htmlTemplate) {
  var newHTML = htmlTemplate
  for (var i = 0; i < variables.length; i++) {
    let regExp = new RegExp(`%%{${variables[i].name}}%%`, 'g');
    let count = (newHTML.match(regExp) || []).length;
    for (var j = 0; j < count; j++) {
      newHTML = newHTML.replace(`%%{${variables[i].name}}%%`, variables[i].value)
    }
  }
  return newHTML
}


module.exports = {
  sendEmail,
  sendWelcomeEmailToUser,
  sendResetPassword,
  parseHTMLVariables,
  sendResetPasswordByAdmin,
  sendPackageArrived,
  sendPackageCreatedByLogistics,
  sendPackageCreatedByUser,
  sendPackageOutOnDelivery,
  sendPackagePaid,
  sendPackagePickedUp,
  sendPackageReadyToPickup,
  sendPackageReadyToShip,
  sendPackageRequiresAction,
  sendPackageShipped,
}
