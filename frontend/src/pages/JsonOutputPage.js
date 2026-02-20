import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/context/AnalysisContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, Check, FileJson } from 'lucide-react';
import { toast } from 'sonner';

const JsonHighlight = ({ data }) => {
  const json = JSON.stringify(data, null, 2);

  const highlighted = json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'json-key' : 'json-string';
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );

  return (
    <pre
      className="json-view p-4 overflow-auto max-h-[70vh] text-xs leading-relaxed"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
};

export default function JsonOutputPage() {
  const { analysisData } = useAnalysis();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!analysisData) navigate('/');
  }, [analysisData, navigate]);

  if (!analysisData) return null;

  const { suspicious_accounts, fraud_rings, summary, graph_data } = analysisData;

  const outputJson = {
    suspicious_accounts: (suspicious_accounts || []).map(a => ({
      account_id: a.account_id,
      suspicion_score: a.suspicion_score,
      detected_patterns: a.detected_patterns,
      ring_id: a.ring_id
    })),
    fraud_rings: (fraud_rings || []).map(r => ({
      ring_id: r.ring_id,
      member_accounts: r.member_accounts,
      pattern_type: r.pattern_type,
      risk_score: r.risk_score
    })),
    summary: summary
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(outputJson, null, 2));
    setCopied(true);
    toast.success('JSON copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(outputJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rift_analysis_${analysisData.id?.slice(0, 8) || 'output'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON file downloaded');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 min-h-screen" data-testid="json-output-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold text-zinc-100 tracking-tight">JSON OUTPUT</h1>
          <p className="text-xs font-mono text-zinc-600 tracking-wider mt-1">
            STRUCTURED ANALYSIS RESULTS
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            data-testid="copy-json-btn"
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className="text-[10px] font-mono tracking-wider bg-transparent border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-sm h-8"
          >
            {copied ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
            {copied ? 'COPIED' : 'COPY'}
          </Button>
          <Button
            data-testid="download-json-btn"
            onClick={handleDownload}
            size="sm"
            className="text-[10px] font-mono tracking-wider bg-blue-600 hover:bg-blue-500 text-white rounded-sm h-8"
          >
            <Download size={12} className="mr-1" />
            DOWNLOAD
          </Button>
        </div>
      </div>

      <Tabs defaultValue="formatted" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800 rounded-sm h-8 p-0.5">
          <TabsTrigger
            value="formatted"
            data-testid="tab-formatted"
            className="text-[10px] font-mono tracking-wider rounded-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-200 h-7 px-4"
          >
            FORMATTED
          </TabsTrigger>
          <TabsTrigger
            value="suspects"
            data-testid="tab-suspects"
            className="text-[10px] font-mono tracking-wider rounded-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-200 h-7 px-4"
          >
            SUSPECTS ({suspicious_accounts?.length || 0})
          </TabsTrigger>
          <TabsTrigger
            value="rings"
            data-testid="tab-rings"
            className="text-[10px] font-mono tracking-wider rounded-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-200 h-7 px-4"
          >
            RINGS ({fraud_rings?.length || 0})
          </TabsTrigger>
          <TabsTrigger
            value="summary"
            data-testid="tab-summary"
            className="text-[10px] font-mono tracking-wider rounded-sm data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-200 h-7 px-4"
          >
            SUMMARY
          </TabsTrigger>
        </TabsList>

        <TabsContent value="formatted" className="mt-4">
          <Card className="bg-zinc-950 border-zinc-800 rounded-sm overflow-hidden">
            <CardContent className="p-0">
              <JsonHighlight data={outputJson} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suspects" className="mt-4">
          <Card className="bg-zinc-950 border-zinc-800 rounded-sm overflow-hidden">
            <CardContent className="p-0">
              <JsonHighlight data={outputJson.suspicious_accounts} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rings" className="mt-4">
          <Card className="bg-zinc-950 border-zinc-800 rounded-sm overflow-hidden">
            <CardContent className="p-0">
              <JsonHighlight data={outputJson.fraud_rings} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <Card className="bg-zinc-950 border-zinc-800 rounded-sm overflow-hidden">
            <CardContent className="p-0">
              <JsonHighlight data={outputJson.summary} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
