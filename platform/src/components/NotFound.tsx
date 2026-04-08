import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

export function NotFound() {
  return (
    <Card>
      <CardHeader>
        <p>Not Found</p>
        <CardTitle>This dashboard route does not exist.</CardTitle>
      </CardHeader>
      <CardContent />
      <CardFooter>
        <Button asChild variant="link">
          <Link to="/">Return to the dashboard</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
