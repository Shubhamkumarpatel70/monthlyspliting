// WhatsApp OTP Service for sending OTP via WhatsApp links
// Generates WhatsApp deep links with pre-filled OTP message

export const sendOTPSMS = async (mobile, code, purpose = 'signup') => {
  try {
    const mobileClean = mobile.replace(/\D/g, ''); // Remove non-digits
    
    // Validate mobile number format (basic check)
    if (mobileClean.length < 10) {
      throw new Error('Invalid mobile number format');
    }

    // Format mobile number with country code
    // Default to India (+91) if no country code provided
    const countryCode = process.env.DEFAULT_COUNTRY_CODE || '+91';
    let formattedMobile = mobileClean;
    
    // If mobile doesn't start with +, add country code
    if (!mobileClean.startsWith('+')) {
      // Remove leading 0 if present (common in Indian numbers)
      if (mobileClean.startsWith('0')) {
        formattedMobile = mobileClean.substring(1);
      }
      formattedMobile = `${countryCode}${formattedMobile}`;
    }

    // Create WhatsApp message
    const message = `Your verification code for monthly splitting is ${code}`;
    
    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // Generate WhatsApp link
    const whatsappLink = `https://wa.me/${formattedMobile.replace(/\+/g, '')}?text=${encodedMessage}`;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📱 [WhatsApp OTP] Mobile:', formattedMobile);
      console.log('📱 [WhatsApp OTP] Code:', code);
      console.log('📱 [WhatsApp OTP] Link:', whatsappLink);
    }

    return { 
      success: true, 
      messageId: `whatsapp-${Date.now()}`, 
      provider: 'whatsapp',
      whatsappLink,
      mobile: formattedMobile,
      code, // Include code in development for testing
    };
  } catch (error) {
    console.error('Error generating WhatsApp link:', error);
    throw new Error('Failed to generate WhatsApp verification link. Please try again.');
  }
};

// Twilio SMS implementation
const sendViaTwilio = async (mobile, message) => {
  try {
    // Dynamic import to avoid requiring Twilio if not configured
    const twilio = await import('twilio');
    const client = twilio.default(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Format mobile number (add country code if not present)
    let formattedMobile = mobile;
    if (!mobile.startsWith('+')) {
      // Assume default country code if not provided
      const countryCode = process.env.DEFAULT_COUNTRY_CODE || '+1';
      formattedMobile = `${countryCode}${mobile}`;
    }

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedMobile,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ SMS sent via Twilio. SID:', result.sid);
    }

    return { success: true, messageId: result.sid, provider: 'twilio' };
  } catch (error) {
    console.error('Twilio error:', error);
    throw new Error(`Failed to send SMS via Twilio: ${error.message}`);
  }
};

// AWS SNS SMS implementation
const sendViaAWSSNS = async (mobile, message) => {
  try {
    // Dynamic import to avoid requiring AWS SDK if not configured
    const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
    
    const snsClient = new SNSClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Format mobile number
    let formattedMobile = mobile;
    if (!mobile.startsWith('+')) {
      const countryCode = process.env.DEFAULT_COUNTRY_CODE || '+1';
      formattedMobile = `${countryCode}${mobile}`;
    }

    const command = new PublishCommand({
      PhoneNumber: formattedMobile,
      Message: message,
    });

    const result = await snsClient.send(command);

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ SMS sent via AWS SNS. MessageId:', result.MessageId);
    }

    return { success: true, messageId: result.MessageId, provider: 'aws-sns' };
  } catch (error) {
    console.error('AWS SNS error:', error);
    throw new Error(`Failed to send SMS via AWS SNS: ${error.message}`);
  }
};
