import { Tabs, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";

export function CurrentSpecimen() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-section">Statistics</p>
      <Tabs defaultValue="activity">
        <TabsList className="-mx-2.5">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="energy">Energy</TabsTrigger>
          <TabsTrigger value="level">Level</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
