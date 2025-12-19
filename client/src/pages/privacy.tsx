import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.history.back()}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-display">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: December 19, 2025</p>
            <p className="text-sm text-muted-foreground mt-2">ContactHub, operated by Giovane Barnes & Pride Mbabit</p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">1. Introduction</h2>
              <p>
                ContactHub, operated by Giovane Barnes and Pride Mbabit ("we," "our," or "us"), is committed to 
                protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your 
                information when you use our contact management and AI-powered messaging service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-2">Personal Information</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Account information (name, email address, password)</li>
                <li>Contact details you provide (names, emails, phone numbers, notes)</li>
                <li>Communication preferences and settings</li>
                <li>Profile information and preferences</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-2">Usage Information</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Log data (IP address, browser type, device information)</li>
                <li>Feature usage and interaction patterns</li>
                <li>Messages and content you create or generate</li>
                <li>AI interaction data (prompts, generated content, feedback)</li>
                <li>Analytics and performance metrics</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">3. How We Use Your Information</h2>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Provide the Service:</strong> Store contacts, schedule messages, manage groups</li>
                <li><strong>AI Features:</strong> Generate personalized messages, provide insights, suggest groups, analyze communication patterns</li>
                <li><strong>Improve the Service:</strong> Analyze usage patterns, fix bugs, develop new features</li>
                <li><strong>Communication:</strong> Send service updates, security alerts, and feature announcements</li>
                <li><strong>Security:</strong> Detect fraud, prevent abuse, protect user data</li>
                <li><strong>Compliance:</strong> Meet legal obligations and enforce our terms</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">4. AI and Machine Learning</h2>
              <p>
                ContactHub uses artificial intelligence and machine learning to provide enhanced features:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Message Generation:</strong> Your contact data and notes are used to generate contextual messages</li>
                <li><strong>Contact Insights:</strong> Communication patterns are analyzed to provide relationship insights</li>
                <li><strong>Smart Suggestions:</strong> AI analyzes your contacts to suggest meaningful groups</li>
                <li><strong>Third-Party AI:</strong> We use Google's Vertex AI (Gemini models) to power AI features</li>
              </ul>
              <p className="mt-4">
                <strong>Important:</strong> Your data is processed through secure APIs and is not used to train public AI models. 
                AI processing occurs in real-time and is subject to the same security standards as our other services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">5. Data Sharing and Disclosure</h2>
              <p>We do not sell your personal information. We may share your data only in these circumstances:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Service Providers:</strong> Firebase (Google), Vertex AI, hosting services</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect rights and safety</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
                <li><strong>With Your Consent:</strong> When you explicitly authorize sharing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">6. Data Security</h2>
              <p>We implement industry-standard security measures:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption in transit (HTTPS/TLS) and at rest</li>
                <li>Firebase Authentication with secure password hashing</li>
                <li>Firestore security rules to protect user data</li>
                <li>Regular security audits and monitoring</li>
                <li>Access controls and principle of least privilege</li>
              </ul>
              <p className="mt-4">
                However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security 
                but continuously work to protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">7. Data Retention</h2>
              <p>
                We retain your data as long as your account is active or as needed to provide services. You can delete 
                your account at any time, which will permanently remove your data from our systems within 30 days, except 
                where we're required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">8. Your Rights and Choices</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Access:</strong> Request a copy of your personal data</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Delete your account and associated data</li>
                <li><strong>Export:</strong> Download your contacts and data</li>
                <li><strong>Opt-out:</strong> Unsubscribe from promotional emails</li>
                <li><strong>Restrict Processing:</strong> Limit how we use your data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">9. Children's Privacy</h2>
              <p>
                ContactHub is not intended for children under 13 years of age. We do not knowingly collect personal 
                information from children under 13. If you believe we have collected information from a child under 13, 
                please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">10. International Data Transfers</h2>
              <p>
                Your information may be transferred to and processed in countries other than your own. We use Firebase 
                and Google Cloud services, which may store data in multiple regions. These transfers are protected by 
                appropriate safeguards.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">11. Cookies and Tracking</h2>
              <p>
                We use cookies and similar technologies to maintain your session, remember preferences, and analyze usage. 
                You can control cookies through your browser settings, though some features may not work properly if disabled.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">12. Third-Party Services</h2>
              <p>We use the following third-party services:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Firebase (Google):</strong> Authentication, database, hosting</li>
                <li><strong>Vertex AI (Google):</strong> AI-powered features</li>
              </ul>
              <p className="mt-4">
                These services have their own privacy policies. We encourage you to review them:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Privacy Policy</a></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">13. California Privacy Rights (CCPA)</h2>
              <p>
                California residents have additional rights under the California Consumer Privacy Act (CCPA), including 
                the right to know what personal information we collect, the right to delete, and the right to opt-out 
                of data sales. We do not sell personal information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">14. GDPR Compliance (EU Users)</h2>
              <p>
                For users in the European Union, we comply with GDPR requirements. Your data is processed based on:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Consent for AI features and communications</li>
                <li>Contract performance to provide the service</li>
                <li>Legitimate interests for security and improvements</li>
                <li>Legal obligations for compliance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">15. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of significant changes via email 
                or through the Service. The "Last updated" date at the top indicates when changes were made.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">16. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or how we handle your data, please contact us:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Email: <a href="mailto:contacthubwebapp@gmail.com" className="text-primary hover:underline">contacthubwebapp@gmail.com</a></li>
                <li>Through the help section in the application</li>
              </ul>
            </section>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                🔒 <strong>Your Privacy Matters:</strong> We're committed to transparency and protecting your data. 
                You have full control over your information and can delete your account at any time.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
