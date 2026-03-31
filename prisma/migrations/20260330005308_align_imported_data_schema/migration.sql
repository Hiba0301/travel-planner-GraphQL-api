-- CreateIndex
CREATE INDEX "Activity_destinationId_name_idx" ON "Activity"("destinationId", "name");

-- CreateIndex
CREATE INDEX "Booking_userId_tripId_activityId_idx" ON "Booking"("userId", "tripId", "activityId");

-- CreateIndex
CREATE INDEX "Destination_tripId_name_arrivalDate_departureDate_idx" ON "Destination"("tripId", "name", "arrivalDate", "departureDate");

-- CreateIndex
CREATE INDEX "Review_userId_destinationId_idx" ON "Review"("userId", "destinationId");

-- CreateIndex
CREATE INDEX "Trip_userId_title_startDate_endDate_idx" ON "Trip"("userId", "title", "startDate", "endDate");
