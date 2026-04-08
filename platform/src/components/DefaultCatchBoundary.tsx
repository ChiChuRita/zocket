import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function DefaultCatchBoundary(props: { error: Error }) {
  return (
    <Card>
      <CardHeader>
        <p>Platform Error</p>
        <CardTitle>{props.error.message}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>The dashboard hit an unexpected error. Check your Convex deployment URL and platform state.</p>
      </CardContent>
    </Card>
  );
}
