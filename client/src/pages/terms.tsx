import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
            <CardTitle className="text-3xl font-display">Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: December 19, 2025</p>
            <p className="text-sm text-muted-foreground mt-2">ContactHub, operated by Giovane Barnes & Pride Mbabit</p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using ContactHub ("the Service"), operated by Giovane Barnes and Pride Mbabit 
                ("we," "us," or "our"), you accept and agree to be bound by the terms and provisions of this agreement. 
                If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">2. Description of Service</h2>
              <p>
                ContactHub provides contact management, group organization, automated messaging, and AI-powered features 
                including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>AI-generated message content</li>
                <li>Contact insights and relationship analysis</li>
                <li>Smart group suggestions</li>
                <li>Communication pattern analysis</li>
                <li>Automated scheduling and reminders</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">3. AI-Generated Content</h2>
              <p>
                You acknowledge that certain features of the Service use artificial intelligence (AI) to generate content, 
                insights, and recommendations. You understand and agree that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>AI-generated content is provided for convenience and may not always be accurate or appropriate</li>
                <li>You are responsible for reviewing and editing all AI-generated content before sending</li>
                <li>ContactHub is not liable for any consequences arising from the use of AI-generated content</li>
                <li>AI analysis is based on the data you provide and may not capture complete context</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">4. User Data and Privacy</h2>
              <p>
                You retain all rights to your contact data. By using the Service, you grant ContactHub permission to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Store and process your contact information</li>
                <li>Use your data to provide AI-powered features and insights</li>
                <li>Analyze usage patterns to improve the Service</li>
              </ul>
              <p>
                We will never sell your personal data. See our{" "}
                <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> for details.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">5. User Responsibilities</h2>
              <p>You agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate and lawful information</li>
                <li>Use the Service in compliance with applicable laws</li>
                <li>Not use the Service for spam, harassment, or illegal activities</li>
                <li>Respect the privacy and consent of your contacts</li>
                <li>Review AI-generated content before sending messages</li>
                <li>Maintain the security of your account credentials</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">6. Acceptable Use</h2>
              <p>You may not use the Service to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Send unsolicited commercial messages (spam)</li>
                <li>Harass, threaten, or harm others</li>
                <li>Distribute malware or malicious content</li>
                <li>Impersonate others or provide false information</li>
                <li>Attempt to gain unauthorized access to the Service</li>
                <li>Scrape or extract data without permission</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">7. Intellectual Property</h2>
              <p>
                The Service and its original content, features, and functionality are owned by Giovane Barnes and 
                Pride Mbabit, and are protected by international copyright, trademark, patent, trade secret, and other 
                intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">8. Limitation of Liability</h2>
              <p>
                ContactHub provides the Service "as is" without warranties of any kind. We are not liable for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Errors or inaccuracies in AI-generated content</li>
                <li>Loss or corruption of data</li>
                <li>Service interruptions or downtime</li>
                <li>Consequences of messages sent through the Service</li>
                <li>Third-party services or integrations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">9. Account Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account if you violate these terms or engage in 
                activities that harm the Service or other users. You may also delete your account at any time.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">10. Changes to Terms</h2>
              <p>
                We may update these terms from time to time. We will notify you of significant changes via email or 
                through the Service. Continued use after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-3">11. Contact Information</h2>
              <p>
                For questions about these Terms of Service, please contact us:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Email: <a href="mailto:contacthubwebapp@gmail.com" className="text-primary hover:underline">contacthubwebapp@gmail.com</a></li>
                <li>Through the help section in the application</li>
              </ul>
            </section>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                By using ContactHub, you acknowledge that you have read, understood, and agree to be bound by these 
                Terms of Service.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
