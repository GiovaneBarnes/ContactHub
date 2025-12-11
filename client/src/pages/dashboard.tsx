import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/mock-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Layers, MessageSquare, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: contacts } = useQuery({ queryKey: ['contacts'], queryFn: api.contacts.list });
  const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: api.groups.list });
  const { data: logs } = useQuery({ queryKey: ['logs'], queryFn: api.logs.list });

  const stats = [
    { label: "Total Contacts", value: contacts?.length || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Active Groups", value: groups?.length || 0, icon: Layers, color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Messages Sent", value: logs?.length || 0, icon: MessageSquare, color: "text-green-500", bg: "bg-green-50" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-2">Welcome back to your contact command center.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs?.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <History className="h-4 w-4" />
                  </div>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Sent message to <span className="font-semibold">{log.groupName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleDateString()} at {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="ml-auto font-medium text-xs text-muted-foreground">
                    {log.recipients} recipients
                  </div>
                </div>
              ))}
              {!logs?.length && (
                <div className="text-center py-8 text-muted-foreground">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/contacts">
              <Button variant="outline" className="w-full justify-start gap-2 h-12 mb-3">
                <Users className="h-5 w-5 text-blue-500" />
                Add New Contact
              </Button>
            </Link>
            <Link href="/groups">
              <Button variant="outline" className="w-full justify-start gap-2 h-12 mb-3">
                <Layers className="h-5 w-5 text-purple-500" />
                Create New Group
              </Button>
            </Link>
            <Link href="/groups">
              <Button variant="outline" className="w-full justify-start gap-2 h-12">
                <MessageSquare className="h-5 w-5 text-green-500" />
                Draft Message
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
