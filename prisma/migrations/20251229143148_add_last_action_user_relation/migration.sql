-- AddForeignKey
ALTER TABLE "ProductionOperationUnit" ADD CONSTRAINT "ProductionOperationUnit_lastActionByUserId_fkey" FOREIGN KEY ("lastActionByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
