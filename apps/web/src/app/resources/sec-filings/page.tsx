import { Badge } from "@whatsfiled/ui/components/badge";
import type { Metadata } from "next";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  FileText,
  Scale,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "SEC Filings Guide - Forms, Deadlines & Transaction Codes",
  description:
    "Complete guide to SEC filings including Form 4 insider trading, Form 10-K, 10-Q, 8-K, Schedule 13D, and Form 13F. Learn filing deadlines, transaction codes (P, S, M, A), and how to interpret insider activity.",
  keywords: [
    "SEC filings",
    "Form 4",
    "Form 4 transaction codes",
    "SEC filing deadlines",
    "insider trading forms",
    "Form 10-K",
    "Form 10-Q",
    "Form 8-K",
    "Schedule 13D",
    "Form 13F",
    "Section 16 filings",
  ],
  openGraph: {
    title: "SEC Filings Guide - Forms, Deadlines & Transaction Codes",
    description:
      "Complete guide to SEC filings including Form 4 insider trading, 10-K, 10-Q, 13D, and 13F. Learn deadlines and transaction codes.",
    type: "article",
  },
  alternates: {
    canonical: "/resources/sec-filings",
  },
};

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function FormCard({
  form,
  title,
  description,
  deadline,
  signalValue,
  children,
}: {
  form: string;
  title: string;
  description: string;
  deadline: string;
  signalValue?: "high" | "medium" | "low";
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 hover:border-foreground/20 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold font-mono">{form}</span>
            {signalValue && (
              <Badge
                variant={
                  signalValue === "high"
                    ? "default"
                    : signalValue === "medium"
                      ? "secondary"
                      : "outline"
                }
                className="text-[10px]"
              >
                {signalValue === "high"
                  ? "High Signal"
                  : signalValue === "medium"
                    ? "Medium Signal"
                    : "Low Signal"}
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0">
          <Clock className="h-3 w-3" />
          {deadline}
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {children}
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function TransactionCodesTable() {
  const codes = [
    {
      code: "P",
      description: "Open market or private purchase",
      color: "bg-green-500",
    },
    {
      code: "S",
      description: "Open market or private sale",
      color: "bg-red-500",
    },
    { code: "A", description: "Grant or award", color: "bg-blue-500" },
    {
      code: "M",
      description: "Exercise or conversion of derivative",
      color: "bg-purple-500",
    },
    { code: "G", description: "Gift", color: "bg-yellow-500" },
    {
      code: "F",
      description: "Payment of exercise price or tax with securities",
      color: "bg-orange-500",
    },
    {
      code: "D",
      description: "Sale or transfer to issuer",
      color: "bg-red-400",
    },
    {
      code: "C",
      description: "Conversion of derivative security",
      color: "bg-purple-400",
    },
    {
      code: "W",
      description: "Acquisition or disposition by will or inheritance",
      color: "bg-gray-500",
    },
    {
      code: "J",
      description: "Other acquisition or disposition",
      color: "bg-gray-400",
    },
    {
      code: "K",
      description: "Equity swap or similar instrument",
      color: "bg-indigo-500",
    },
    {
      code: "U",
      description: "Disposition due to tender of shares",
      color: "bg-red-300",
    },
  ];

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium w-20">Code</th>
            <th className="px-4 py-3 text-left font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((item, i) => (
            <tr
              key={item.code}
              className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}
            >
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="font-mono font-bold">{item.code}</span>
                </span>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {item.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeadlinesTable() {
  const deadlines = [
    { form: "Form 3", deadline: "10 days of becoming insider" },
    { form: "Form 4", deadline: "2 business days of transaction" },
    { form: "Form 5", deadline: "45 days after fiscal year end" },
    { form: "Form 8-K", deadline: "4 business days of event" },
    { form: "Form 10-Q", deadline: "40-45 days after quarter end" },
    { form: "Form 10-K", deadline: "60-90 days after fiscal year end" },
    { form: "Schedule 13D", deadline: "10 days of crossing 5%" },
    { form: "Schedule 13G", deadline: "45 days after year end (QIIs)" },
    { form: "Form 13F", deadline: "45 days after quarter end" },
  ];

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Form</th>
            <th className="px-4 py-3 text-left font-medium">Filing Deadline</th>
          </tr>
        </thead>
        <tbody>
          {deadlines.map((item, i) => (
            <tr
              key={item.form}
              className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}
            >
              <td className="px-4 py-2.5 font-mono font-medium">{item.form}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {item.deadline}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilerCategoriesTable() {
  const categories = [
    {
      category: "Large Accelerated",
      float: "≥ $700M",
      tenK: "60 days",
      tenQ: "40 days",
    },
    {
      category: "Accelerated",
      float: "$75M - $700M",
      tenK: "75 days",
      tenQ: "40 days",
    },
    {
      category: "Non-Accelerated",
      float: "< $75M",
      tenK: "90 days",
      tenQ: "45 days",
    },
    {
      category: "Smaller Reporting",
      float: "< $250M",
      tenK: "90 days",
      tenQ: "45 days",
    },
  ];

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Category</th>
            <th className="px-4 py-3 text-left font-medium">Public Float</th>
            <th className="px-4 py-3 text-center font-medium">10-K</th>
            <th className="px-4 py-3 text-center font-medium">10-Q</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((item, i) => (
            <tr
              key={item.category}
              className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}
            >
              <td className="px-4 py-2.5 font-medium">{item.category}</td>
              <td className="px-4 py-2.5 text-muted-foreground font-mono">
                {item.float}
              </td>
              <td className="px-4 py-2.5 text-center text-muted-foreground">
                {item.tenK}
              </td>
              <td className="px-4 py-2.5 text-center text-muted-foreground">
                {item.tenQ}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SecFilingsPage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero Section */}
      <div className="border-b border-border bg-gradient-to-b from-muted/50 to-background">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Activity Feed
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                SEC Filings Reference
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                A comprehensive explanation of SEC filings, their purposes, and
                filing requirements.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 space-y-16">
        {/* Insider Transaction Forms */}
        <section>
          <SectionHeader
            icon={TrendingUp}
            title="Insider Transaction Forms (Section 16)"
            subtitle="Required filings for company insiders reporting their trading activity"
          />

          <div className="space-y-4">
            <FormCard
              form="Form 3"
              title="Initial Statement of Beneficial Ownership"
              description="The initial disclosure filed when a person becomes an 'insider' of a public company. Reports all equity securities beneficially owned at the time of becoming a director, officer, or 10% owner."
              deadline="10 days"
              signalValue="low"
            >
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoCard title="Who must file">
                  <ul className="space-y-1">
                    <li>• Directors</li>
                    <li>• Officers (CEO, CFO, COO, etc.)</li>
                    <li>• 10%+ beneficial owners</li>
                  </ul>
                </InfoCard>
                <InfoCard title="What it contains">
                  <ul className="space-y-1">
                    <li>• Reporting person's identity</li>
                    <li>• All securities owned</li>
                    <li>• Nature of ownership</li>
                  </ul>
                </InfoCard>
              </div>
            </FormCard>

            <FormCard
              form="Form 4"
              title="Statement of Changes in Beneficial Ownership"
              description="The primary disclosure form for insider transactions. Reports any change in beneficial ownership of company securities including purchases, sales, grants, and option exercises."
              deadline="2 business days"
              signalValue="high"
            >
              <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium text-sm mb-1">
                  <AlertCircle className="h-4 w-4" />
                  Most Important for Tracking Insider Activity
                </div>
                <p className="text-sm text-muted-foreground">
                  Form 4 filings provide real-time visibility into insider
                  trading. A cluster of insider purchases often signals
                  management confidence.
                </p>
              </div>
            </FormCard>

            <FormCard
              form="Form 4/A"
              title="Amendment to Form 4"
              description="A correction or amendment to a previously filed Form 4. Filed when there are errors in price, share count, or missing transactions. Form 4/A supersedes the original filing."
              deadline="As soon as discovered"
              signalValue="medium"
            />

            <FormCard
              form="Form 5"
              title="Annual Statement of Beneficial Ownership"
              description="An annual report of transactions that were not required to be reported on Form 4, or transactions that should have been reported but were missed. Often contains stale information."
              deadline="45 days after FY end"
              signalValue="low"
            />
          </div>
        </section>

        {/* Transaction Codes */}
        <section>
          <SectionHeader
            icon={FileText}
            title="Transaction Codes (Form 4)"
            subtitle="Codes used to identify the type of insider transaction"
          />
          <TransactionCodesTable />
          <p className="text-sm text-muted-foreground mt-4">
            <strong>P</strong> (Purchase) and <strong>S</strong> (Sale) are the
            most significant codes for analyzing insider sentiment.{" "}
            <strong>A</strong> (Award) and <strong>M</strong> (Exercise)
            typically represent compensation-related transactions.
          </p>
        </section>

        {/* Corporate Disclosure Forms */}
        <section>
          <SectionHeader
            icon={Building2}
            title="Corporate Disclosure Forms"
            subtitle="Regular financial reporting requirements for public companies"
          />

          <div className="space-y-4">
            <FormCard
              form="Form 10-K"
              title="Annual Report"
              description="Comprehensive annual report providing a complete overview of a company's business and financial condition. Includes audited financial statements, MD&A, risk factors, and executive compensation details."
              deadline="60-90 days"
            />

            <FormCard
              form="Form 10-Q"
              title="Quarterly Report"
              description="Quarterly update on a company's financial condition with unaudited financial statements. Filed for Q1, Q2, and Q3 (Q4 is covered by the 10-K)."
              deadline="40-45 days"
            />

            <FormCard
              form="Form 8-K"
              title="Current Report"
              description="Report of significant events that shareholders should know about between regular quarterly and annual reports. Covers material agreements, acquisitions, executive changes, and more."
              deadline="4 business days"
            />
          </div>
        </section>

        {/* Ownership Forms */}
        <section>
          <SectionHeader
            icon={Users}
            title="Ownership & Proxy Forms"
            subtitle="Disclosures for significant shareholders and shareholder meetings"
          />

          <div className="space-y-4">
            <FormCard
              form="Schedule 13D"
              title="Beneficial Ownership Report"
              description="Required when a person or group acquires more than 5% of a company's voting securities with intent to influence control. Must disclose identity, funding source, and purpose of the transaction."
              deadline="10 days"
              signalValue="high"
            />

            <FormCard
              form="Schedule 13G"
              title="Beneficial Ownership Report (Short Form)"
              description="Simplified version of Schedule 13D for passive investors with no intent to influence control. Available to qualified institutional investors and passive investors under 20%."
              deadline="45 days (QIIs)"
              signalValue="medium"
            />

            <FormCard
              form="Form 13F"
              title="Quarterly Holdings Report"
              description="Quarterly disclosure of equity holdings by institutional investment managers with over $100M in qualifying assets. Reveals positions of hedge funds, mutual funds, and other institutions."
              deadline="45 days"
              signalValue="medium"
            />
          </div>
        </section>

        {/* Quick Reference Tables */}
        <section>
          <SectionHeader
            icon={Calendar}
            title="Filing Deadlines Quick Reference"
            subtitle="Summary of filing deadlines for common SEC forms"
          />
          <DeadlinesTable />
        </section>

        <section>
          <SectionHeader
            icon={Scale}
            title="Filer Categories"
            subtitle="Different filing deadlines based on company size"
          />
          <FilerCategoriesTable />
          <p className="text-sm text-muted-foreground mt-4">
            Public float is the market value of a company's outstanding shares
            held by non-affiliates. Larger companies have shorter filing
            deadlines.
          </p>
        </section>

        {/* Resources */}
        <section className="rounded-xl border border-border bg-muted/30 p-6">
          <h2 className="text-lg font-semibold mb-4">Additional Resources</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <a
              href="https://www.sec.gov/cgi-bin/browse-edgar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition-colors"
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">SEC EDGAR</div>
                <div className="text-xs text-muted-foreground">
                  Search all filings
                </div>
              </div>
            </a>
            <a
              href="https://www.sec.gov/search-filings"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition-colors"
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">Filing Search</div>
                <div className="text-xs text-muted-foreground">
                  Advanced search
                </div>
              </div>
            </a>
            <a
              href="https://www.sec.gov/forms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition-colors"
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">SEC Forms List</div>
                <div className="text-xs text-muted-foreground">
                  All form types
                </div>
              </div>
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">
            Data sourced from SEC EDGAR.{" "}
            <Link href="/" className="text-foreground hover:underline">
              View recent insider trading activity →
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
