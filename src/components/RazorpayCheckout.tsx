import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';

/**
 * Schemes Razorpay hands off to a native app (UPI apps, and the wallet/netbanking
 * deep links some banks use). A WebView cannot load these — they must go to
 * Android's app launcher instead, or the user sees "web page not available".
 */
const APP_SCHEME = /^(upi|intent|phonepe|tez|paytmmp|gpay|bhim|credpay|amazonpay|myairtelupi|market|whatsapp):/i;

/** What Razorpay hands back on success — the server verifies these. */
export interface CheckoutResult {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

interface Props {
  visible: boolean;
  keyId: string;
  orderId: string;
  /** Rupees — converted to paise for Razorpay. */
  amount: number;
  description: string;
  prefill?: { name?: string; contact?: string; email?: string };
  onSuccess: (result: CheckoutResult) => void;
  /** Cancelled, dismissed, or failed — the caller decides what to show. */
  onCancel: (reason?: string) => void;
}

/**
 * Razorpay Checkout for the app, hosted in a WebView.
 *
 * Razorpay has no Expo-managed native module, so we load their standard web
 * checkout inside a WebView and bridge the result back over postMessage. Card
 * and UPI details are entered on Razorpay's own page — they never touch our JS,
 * which keeps this PCI-compliant, the same as the web app.
 *
 * The payment is NOT trusted here: the signature returned by Razorpay is
 * forwarded to the backend, which verifies the HMAC before confirming anything.
 */
export function RazorpayCheckout({
  visible,
  keyId,
  orderId,
  amount,
  description,
  prefill,
  onSuccess,
  onCancel,
}: Props) {
  /** Inline warning (e.g. a UPI app isn't installed) — never closes the modal. */
  const [notice, setNotice] = useState('');

  // Values are JSON-encoded into the page, so a stray quote in a name or
  // description can't break out of the script.
  const html = useMemo(() => {
    const options = {
      key: keyId,
      order_id: orderId,
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      name: 'MV Cleaning Services',
      description,
      prefill: prefill ?? {},
      theme: { color: '#1e40af' },
    };
    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
      html, body { margin: 0; height: 100%; background: #ffffff; }
    </style>
  </head>
  <body>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      (function () {
        var post = function (payload) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        };
        // The SDK failing to load must not leave a blank screen forever.
        if (typeof Razorpay === 'undefined') {
          post({ type: 'error', message: 'Could not reach the payment gateway.' });
          return;
        }
        var options = ${JSON.stringify(options)};
        options.handler = function (response) {
          post({ type: 'success', response: response });
        };
        options.modal = {
          escape: false,
          ondismiss: function () { post({ type: 'dismiss' }); },
        };
        try {
          var rzp = new Razorpay(options);
          rzp.on('payment.failed', function (resp) {
            post({
              type: 'error',
              message: (resp && resp.error && resp.error.description) || 'Payment failed.',
            });
          });
          rzp.open();
        } catch (e) {
          post({ type: 'error', message: 'Could not open checkout.' });
        }
      })();
    </script>
  </body>
</html>`;
  }, [keyId, orderId, amount, description, prefill]);

  /**
   * Only a failure to load the checkout page itself should abort the payment.
   * Once Razorpay is up, a WebView error is usually a blocked app-link probe or
   * a cancelled sub-resource — killing the modal there would strand a customer
   * who is mid-payment in their UPI app.
   */
  const loaded = useRef(false);
  const handleWebViewError = () => {
    if (loaded.current) return;
    onCancel('Could not reach the payment gateway.');
  };

  /**
   * Launch a UPI/wallet app. `intent://` URLs carry a browser_fallback_url for
   * when the app isn't installed, so try that before giving up — otherwise a
   * customer without that one app just sees a dead end.
   */
  const openAppLink = async (url: string) => {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      /* app not installed — fall through */
    }

    const fallback = url.match(/browser_fallback_url=([^;&]+)/);
    if (fallback) {
      try {
        await Linking.openURL(decodeURIComponent(fallback[1]));
        return;
      } catch {
        /* fall through */
      }
    }
    // Leave the modal open: they can still pick a different payment method.
    setNotice('That app isn’t installed. Try another method or pay by card.');
  };

  const handleMessage = (raw: string) => {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // ignore anything that isn't ours
    }

    if (msg.type === 'success' && msg.response) {
      onSuccess({
        razorpayOrderId: msg.response.razorpay_order_id,
        razorpayPaymentId: msg.response.razorpay_payment_id,
        razorpaySignature: msg.response.razorpay_signature,
      });
    } else if (msg.type === 'error') {
      onCancel(msg.message);
    } else if (msg.type === 'dismiss') {
      onCancel();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onCancel()}>
      <View style={styles.root}>
        <View style={styles.bar}>
          <Text style={styles.barTitle}>Secure payment</Text>
          <Pressable onPress={() => onCancel()} hitSlop={12} accessibilityLabel="Close payment">
            <X size={22} color="#0f172a" />
          </Pressable>
        </View>
        {notice !== '' && (
          <Pressable onPress={() => setNotice('')}>
            <Text style={styles.notice}>{notice}</Text>
          </Pressable>
        )}
        {visible && (
          <WebView
            source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            // Razorpay opens UPI apps in a new window; without this the tap is
            // silently dropped instead of reaching onShouldStartLoadWithRequest.
            setSupportMultipleWindows={false}
            // Hand app links (upi://, intent://, phonepe:// …) to Android rather
            // than trying to render them as a page.
            onShouldStartLoadWithRequest={(req) => {
              if (!APP_SCHEME.test(req.url)) return true;
              openAppLink(req.url);
              return false; // never navigate the WebView to an app link
            }}
            onMessage={(e) => handleMessage(e.nativeEvent.data)}
            onError={handleWebViewError}
            onLoadEnd={() => { loaded.current = true; }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#1e40af" />
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  barTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  notice: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
