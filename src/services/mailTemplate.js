import Mailgen from "mailgen";

const welcomeEmailContent = (fullname) => {
     return {
          body: {
               name: fullname,
               intro: `Welcome aboard, ${fullname}! We're thrilled to have you join us.`,
               action: {
                    instructions: 'Get started by exploring your dashboard:',
                    button: {
                         color: '#22BC66',
                         text: 'Go to Dashboard',
                         link: 'https://goinupuagau.com/dashboard'
                    }
               },
               outro: 'If you have any questions, just reply to this email — we\'re always happy to help.'
          }
     };
};

const emailVerificationOtpContent = (fullname, otp) => {
     return {
          body: {
               name: fullname,
               intro: `Welcome to Our Website, ${fullname}! We're very excited to have you on board.`,
               table: {
                    data: [
                         { item: 'Your Verification Code', description: otp }
                    ],
                    columns: {
                         customWidth: {
                              item: '40%',
                              description: '60%'
                         }
                    }
               },
               outro: [
                    'Enter this code to verify your account. This OTP is valid for 5 minutes.',
                    'If you didn\'t create an account, you can safely ignore this email.'
               ]
          }
     };
};

const passwordResetOtpContent = (fullname, otp) => {
     return {
          body: {
               name: fullname,
               intro: 'We received a request to reset your password.',
               table: {
                    data: [
                         { item: 'Your OTP Code', description: otp }
                    ],
                    columns: {
                         customWidth: {
                              item: '40%',
                              description: '60%'
                         }
                    }
               },
               outro: [
                    'This OTP is valid for 10 minutes. Please do not share it with anyone.',
                    'If you didn\'t request a password reset, you can safely ignore this email.'
               ]
          }
     };
};

export { welcomeEmailContent, emailVerificationOtpContent, passwordResetOtpContent };